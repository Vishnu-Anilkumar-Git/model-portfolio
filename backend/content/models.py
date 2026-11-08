"""Single source of truth for every piece of portfolio content.

The public site, chatbot retrieval, SEO/JSON-LD payload and admin panel all read
from these models. Nothing about Vishnu should be edited in HTML or JSON again.
"""

from __future__ import annotations

from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from .validators import (
    validate_avatar_image,
    validate_badge_image,
    validate_project_image,
    validate_resume_pdf,
    validate_seo_image,
)


class OrderedModel(models.Model):
    order = models.PositiveIntegerField(
        default=0, help_text="Lower numbers appear first."
    )
    visible = models.BooleanField(default=True)

    class Meta:
        abstract = True
        ordering = ("order", "pk")


class Profile(models.Model):
    """Singleton row (pk=1) holding identity, copy and site-wide settings."""

    name = models.CharField(max_length=120, default="Vishnu Anilkumar")
    headline = models.CharField(
        max_length=200,
        help_text="Hero tagline shown under the name.",
        default="Cybersecurity Student · Aspiring SOC Analyst",
    )
    target_role = models.CharField(max_length=120, default="SOC Analyst")
    location = models.CharField(max_length=120, default="Kerala, India")
    email = models.EmailField(default="vishnuanil2k05@gmail.com")
    phone = models.CharField(max_length=40, blank=True)
    availability = models.CharField(
        max_length=240,
        blank=True,
        help_text="Short availability line, e.g. 'Open to security internships'.",
    )

    hero_eyebrow = models.CharField(
        max_length=160, default="root@portfolio:~$ whoami"
    )
    about_heading = models.CharField(
        max_length=240,
        default="From building software to breaking (and defending) it.",
    )
    bio = models.TextField(
        help_text="About copy. Separate paragraphs with a blank line."
    )

    github_url = models.URLField(blank=True)
    linkedin_url = models.URLField(blank=True)
    website_url = models.URLField(blank=True)
    twitter_url = models.URLField(blank=True)

    avatar = models.ImageField(
        upload_to="profile/",
        blank=True,
        null=True,
        validators=[validate_avatar_image],
    )
    resume = models.FileField(
        upload_to="resume/",
        blank=True,
        null=True,
        validators=[validate_resume_pdf],
        help_text="PDF resume. The download button only appears once this is set.",
    )

    seo_title = models.CharField(
        max_length=200,
        default="Vishnu Anilkumar | Cybersecurity Student & Aspiring SOC Analyst",
    )
    seo_description = models.TextField(
        default=(
            "Vishnu Anilkumar is a BCA graduate and cybersecurity student from "
            "Kerala aspiring to become a SOC Analyst, with interests in ethical "
            "hacking, threat intelligence, security operations and AI security."
        )
    )
    canonical_url = models.URLField(default="https://vishnuanilkumar.in/")
    og_image = models.ImageField(
        upload_to="seo/", blank=True, null=True, validators=[validate_seo_image]
    )

    chatbot_greeting = models.CharField(
        max_length=240,
        default="Ask me about Vishnu's projects, skills, certifications or background.",
    )
    footer_note = models.CharField(
        max_length=240, default="Designed and built by Vishnu Anilkumar."
    )

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Profile & site settings"
        verbose_name_plural = "Profile & site settings"

    def __str__(self) -> str:
        return self.name

    def save(self, *args: object, **kwargs: object) -> None:
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "Profile":
        profile, _ = cls.objects.get_or_create(pk=1)
        return profile

    @property
    def bio_paragraphs(self) -> list[str]:
        return [p.strip() for p in self.bio.split("\n\n") if p.strip()]


class SocialLink(OrderedModel):
    ICONS = [
        ("github", "GitHub"),
        ("linkedin", "LinkedIn"),
        ("mail", "Email"),
        ("globe", "Website"),
        ("x", "X / Twitter"),
        ("tryhackme", "TryHackMe"),
        ("hackthebox", "Hack The Box"),
        ("link", "Generic link"),
    ]

    label = models.CharField(max_length=80)
    url = models.CharField(max_length=300)
    icon = models.CharField(max_length=20, choices=ICONS, default="link")

    class Meta(OrderedModel.Meta):
        verbose_name = "Social link"

    def __str__(self) -> str:
        return self.label


class SkillCategory(OrderedModel):
    name = models.CharField(max_length=120)
    description = models.CharField(max_length=240, blank=True)

    class Meta(OrderedModel.Meta):
        verbose_name = "Skill category"
        verbose_name_plural = "Skill categories"

    def __str__(self) -> str:
        return self.name


class Skill(OrderedModel):
    category = models.ForeignKey(
        SkillCategory, on_delete=models.CASCADE, related_name="skills"
    )
    name = models.CharField(max_length=120)
    level = models.PositiveSmallIntegerField(
        blank=True,
        null=True,
        help_text="Optional 0-100 confidence level. Leave blank to hide the meter.",
    )

    class Meta(OrderedModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=("category", "name"), name="unique_skill_per_category"
            )
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.category.name})"


class Project(OrderedModel):
    class Status(models.TextChoices):
        COMPLETED = "completed", "Completed"
        ONGOING = "ongoing", "Ongoing"
        UPCOMING = "upcoming", "Upcoming"

    class Accent(models.TextChoices):
        ORANGE = "orange", "Orange"
        TEAL = "teal", "Teal"
        VIOLET = "violet", "Violet"

    slug = models.SlugField(max_length=140, unique=True, blank=True)
    title = models.CharField(max_length=160)
    subtitle = models.CharField(max_length=200, blank=True)
    summary = models.TextField(
        max_length=500, help_text="One or two sentences for the project card."
    )
    description = models.TextField(
        blank=True,
        help_text="Full case study. Separate paragraphs with a blank line.",
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ONGOING
    )
    progress = models.PositiveSmallIntegerField(
        blank=True,
        null=True,
        help_text="Ongoing projects only: 0-100.",
    )
    tech_stack = models.CharField(
        max_length=300, blank=True, help_text="Comma-separated technologies."
    )

    repo_url = models.URLField(blank=True)
    demo_url = models.URLField(blank=True)
    accent = models.CharField(
        max_length=20,
        choices=Accent.choices,
        default=Accent.ORANGE,
        help_text="Placeholder card tint when no cover image is set.",
    )
    cover_image = models.ImageField(
        upload_to="projects/",
        blank=True,
        null=True,
        validators=[validate_project_image],
    )
    architecture_image = models.ImageField(
        upload_to="projects/architecture/",
        blank=True,
        null=True,
        validators=[validate_project_image],
    )
    architecture_notes = models.TextField(
        blank=True, help_text="How the system fits together. Blank lines separate paragraphs."
    )
    highlights = models.TextField(
        blank=True, help_text="One highlight per line."
    )
    learnings = models.TextField(
        blank=True, help_text="What you learned building it."
    )

    started_on = models.DateField(blank=True, null=True)
    completed_on = models.DateField(blank=True, null=True)
    featured = models.BooleanField(default=False)
    meta_description = models.CharField(max_length=200, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta(OrderedModel.Meta):
        indexes = [
            models.Index(fields=("status", "visible")),
        ]

    def __str__(self) -> str:
        return self.title

    def save(self, *args: object, **kwargs: object) -> None:
        if not self.slug:
            base = slugify(self.title)[:120] or "project"
            slug = base
            counter = 2
            while (
                Project.objects.filter(slug=slug)
                .exclude(pk=self.pk)
                .exists()
            ):
                slug = f"{base}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    @property
    def tech_list(self) -> list[str]:
        return [t.strip() for t in self.tech_stack.split(",") if t.strip()]

    @property
    def highlight_list(self) -> list[str]:
        return [h.strip() for h in self.highlights.splitlines() if h.strip()]

    @property
    def description_paragraphs(self) -> list[str]:
        return [p.strip() for p in self.description.split("\n\n") if p.strip()]

    @property
    def architecture_paragraphs(self) -> list[str]:
        return [
            p.strip() for p in self.architecture_notes.split("\n\n") if p.strip()
        ]

    @property
    def timeline_label(self) -> str:
        if self.status == self.Status.UPCOMING:
            return "Planned"
        if self.started_on:
            start = self.started_on.strftime("%b %Y")
            if self.completed_on:
                return f"{start} – {self.completed_on.strftime('%b %Y')}"
            return f"{start} – present"
        return self.get_status_display()


class ProjectScreenshot(models.Model):
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="screenshots"
    )
    image = models.ImageField(
        upload_to="projects/screenshots/", validators=[validate_project_image]
    )
    caption = models.CharField(max_length=200, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("order", "pk")

    def __str__(self) -> str:
        return f"{self.project.title} screenshot {self.pk}"


class Education(OrderedModel):
    institution = models.CharField(max_length=200)
    degree = models.CharField(max_length=200)
    field_of_study = models.CharField(max_length=200, blank=True)
    university = models.CharField(max_length=200, blank=True)
    location = models.CharField(max_length=160, blank=True)
    start_year = models.PositiveSmallIntegerField(blank=True, null=True)
    end_year = models.PositiveSmallIntegerField(
        blank=True, null=True, help_text="Leave blank if ongoing."
    )
    grade = models.CharField(max_length=80, blank=True)
    description = models.TextField(blank=True)
    current = models.BooleanField(default=False)

    class Meta(OrderedModel.Meta):
        verbose_name_plural = "Education"

    def __str__(self) -> str:
        return f"{self.degree} — {self.institution}"

    @property
    def period(self) -> str:
        if self.current:
            return f"{self.start_year or ''} – present".strip(" –")
        if self.start_year and self.end_year:
            return f"{self.start_year} – {self.end_year}"
        return str(self.end_year or self.start_year or "")


class Experience(OrderedModel):
    class Kind(models.TextChoices):
        WORK = "work", "Work"
        INTERNSHIP = "internship", "Internship"
        FREELANCE = "freelance", "Freelance"
        VOLUNTEER = "volunteer", "Volunteer"
        EDUCATION = "education", "Education"
        PROJECT = "project", "Independent project"

    role = models.CharField(max_length=160)
    organization = models.CharField(max_length=160)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.WORK)
    location = models.CharField(max_length=160, blank=True)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    current = models.BooleanField(default=False)
    summary = models.TextField(blank=True)
    highlights = models.TextField(blank=True, help_text="One highlight per line.")

    class Meta(OrderedModel.Meta):
        verbose_name_plural = "Experience"

    def __str__(self) -> str:
        return f"{self.role} — {self.organization}"

    @property
    def period(self) -> str:
        def fmt(d: object) -> str:
            return d.strftime("%b %Y") if d else ""  # type: ignore[attr-defined]

        if self.current:
            return f"{fmt(self.start_date)} – present".strip()
        if self.start_date and self.end_date:
            return f"{fmt(self.start_date)} – {fmt(self.end_date)}"
        return fmt(self.end_date or self.start_date)

    @property
    def highlight_list(self) -> list[str]:
        return [h.strip() for h in self.highlights.splitlines() if h.strip()]


class Certification(OrderedModel):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"
        PLANNED = "planned", "Planned"

    class Category(models.TextChoices):
        CERTIFICATION = "certification", "Certification"
        TRAINING = "training", "Training"

    name = models.CharField(max_length=200)
    issuer = models.CharField(max_length=160, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.IN_PROGRESS
    )
    category = models.CharField(
        max_length=20, choices=Category.choices, default=Category.CERTIFICATION
    )
    issued_on = models.DateField(blank=True, null=True)
    expires_on = models.DateField(blank=True, null=True)
    credential_id = models.CharField(max_length=120, blank=True)
    credential_url = models.URLField(blank=True)
    description = models.CharField(max_length=300, blank=True)

    class Meta(OrderedModel.Meta):
        indexes = [models.Index(fields=("status", "visible"))]

    def __str__(self) -> str:
        return self.name


class Achievement(OrderedModel):
    class Category(models.TextChoices):
        LAB = "lab", "Hands-on lab"
        CTF = "ctf", "CTF / challenge"
        AWARD = "award", "Award"
        COMMUNITY = "community", "Community"
        OTHER = "other", "Other"

    title = models.CharField(max_length=200)
    organization = models.CharField(
        max_length=160, blank=True, help_text="e.g. TryHackMe, Hack The Box"
    )
    category = models.CharField(
        max_length=20, choices=Category.choices, default=Category.LAB
    )
    occurred_on = models.DateField(blank=True, null=True)
    description = models.TextField(blank=True)
    url = models.URLField(blank=True)
    badge_image = models.ImageField(
        upload_to="achievements/",
        blank=True,
        null=True,
        validators=[validate_badge_image],
    )

    class Meta(OrderedModel.Meta):
        verbose_name_plural = "Achievements & labs"

    def __str__(self) -> str:
        return self.title


class FAQ(OrderedModel):
    question = models.CharField(max_length=240)
    answer = models.TextField()

    class Meta(OrderedModel.Meta):
        verbose_name = "FAQ"
        verbose_name_plural = "FAQs"

    def __str__(self) -> str:
        return self.question


class SuggestedQuestion(OrderedModel):
    text = models.CharField(max_length=160)

    class Meta(OrderedModel.Meta):
        verbose_name = "Chatbot suggested question"

    def __str__(self) -> str:
        return self.text


class ContactMessage(models.Model):
    name = models.CharField(max_length=120)
    email = models.EmailField()
    subject = models.CharField(max_length=200, blank=True)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    ip_hash = models.CharField(max_length=64, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Contact message"

    def __str__(self) -> str:
        return f"{self.name} <{self.email}> — {self.created_at:%Y-%m-%d}"

    def mark_read(self) -> None:
        self.is_read = True
        self.save(update_fields=["is_read"])


class ChatLog(models.Model):
    """Read-only analytics for the portfolio assistant."""

    question = models.TextField()
    answer = models.TextField(blank=True)
    sources = models.JSONField(default=list, blank=True)
    provider = models.CharField(max_length=40, blank=True)
    latency_ms = models.PositiveIntegerField(default=0)
    session_id = models.CharField(max_length=64, blank=True)
    flagged = models.BooleanField(
        default=False, help_text="Request was refused by the prompt-injection guard."
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Chatbot log"

    def __str__(self) -> str:
        return self.question[:80]


class SiteRebuild(models.Model):
    """Singleton bookkeeping for the static-site rebuild hook.

    The timestamp is claimed in the database so the 60-second debounce holds
    across Gunicorn workers, not just within one process's local memory.
    """

    last_requested_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Site rebuild"
        verbose_name_plural = "Site rebuild"

    def __str__(self) -> str:
        return "Site rebuild state"

    def save(self, *args: object, **kwargs: object) -> None:
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "SiteRebuild":
        state, _ = cls.objects.get_or_create(pk=1)
        return state
