from __future__ import annotations

from typing import Any

from rest_framework import serializers

from .models import (
    Achievement,
    Certification,
    ChatLog,
    ContactMessage,
    Education,
    Experience,
    FAQ,
    Profile,
    Project,
    ProjectScreenshot,
    Skill,
    SkillCategory,
    SocialLink,
    SuggestedQuestion,
)


class AbsoluteImageMixin:
    """DRF returns absolute image/file URLs when a request is in context."""

    pass


# ---------------------------------------------------------------------------
# Public read serializers
# ---------------------------------------------------------------------------


class SocialLinkPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialLink
        fields = ("id", "label", "url", "icon", "order")


class SkillPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ("id", "name", "level")


class SkillCategoryPublicSerializer(serializers.ModelSerializer):
    skills = serializers.SerializerMethodField()

    class Meta:
        model = SkillCategory
        fields = ("id", "name", "description", "skills")

    def get_skills(self, obj: SkillCategory) -> list[dict[str, Any]]:
        skills = [s for s in obj.skills.all() if s.visible]
        return SkillPublicSerializer(skills, many=True).data


class ProjectScreenshotPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectScreenshot
        fields = ("id", "image", "caption", "order")


class ProjectListSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    tech = serializers.SerializerMethodField()
    cover_image = serializers.ImageField(read_only=True)
    timeline = serializers.CharField(source="timeline_label", read_only=True)

    class Meta:
        model = Project
        fields = (
            "id",
            "slug",
            "title",
            "subtitle",
            "summary",
            "status",
            "status_label",
            "progress",
            "tech",
            "repo_url",
            "demo_url",
            "cover_image",
            "accent",
            "featured",
            "timeline",
            "started_on",
            "completed_on",
            "order",
        )

    def get_tech(self, obj: Project) -> list[str]:
        return obj.tech_list


class ProjectDetailSerializer(ProjectListSerializer):
    description = serializers.SerializerMethodField()
    architecture = serializers.SerializerMethodField()
    highlights = serializers.SerializerMethodField()
    screenshots = ProjectScreenshotPublicSerializer(many=True, read_only=True)
    architecture_image = serializers.ImageField(read_only=True)

    class Meta(ProjectListSerializer.Meta):
        fields = ProjectListSerializer.Meta.fields + (
            "description",
            "architecture",
            "architecture_image",
            "highlights",
            "learnings",
            "meta_description",
            "screenshots",
            "updated_at",
        )

    def get_description(self, obj: Project) -> list[str]:
        return obj.description_paragraphs

    def get_architecture(self, obj: Project) -> list[str]:
        return obj.architecture_paragraphs

    def get_highlights(self, obj: Project) -> list[str]:
        return obj.highlight_list


class EducationPublicSerializer(serializers.ModelSerializer):
    period = serializers.CharField(read_only=True)

    class Meta:
        model = Education
        fields = (
            "id",
            "institution",
            "degree",
            "field_of_study",
            "university",
            "location",
            "start_year",
            "end_year",
            "grade",
            "description",
            "current",
            "period",
        )


class ExperiencePublicSerializer(serializers.ModelSerializer):
    period = serializers.CharField(read_only=True)
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    highlights = serializers.SerializerMethodField()

    class Meta:
        model = Experience
        fields = (
            "id",
            "role",
            "organization",
            "kind",
            "kind_label",
            "location",
            "start_date",
            "end_date",
            "current",
            "summary",
            "highlights",
            "period",
        )

    def get_highlights(self, obj: Experience) -> list[str]:
        return obj.highlight_list


class CertificationPublicSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    category_label = serializers.CharField(
        source="get_category_display", read_only=True
    )

    class Meta:
        model = Certification
        fields = (
            "id",
            "name",
            "issuer",
            "status",
            "status_label",
            "category",
            "category_label",
            "issued_on",
            "expires_on",
            "credential_id",
            "credential_url",
            "description",
        )


class AchievementPublicSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(
        source="get_category_display", read_only=True
    )

    class Meta:
        model = Achievement
        fields = (
            "id",
            "title",
            "organization",
            "category",
            "category_label",
            "occurred_on",
            "description",
            "url",
            "badge_image",
        )


class FAQPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQ
        fields = ("id", "question", "answer")


class SuggestedQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SuggestedQuestion
        fields = ("id", "text")


class ProfilePublicSerializer(serializers.ModelSerializer):
    bio = serializers.SerializerMethodField()
    resume_url = serializers.SerializerMethodField()
    avatar = serializers.ImageField(read_only=True)
    og_image = serializers.ImageField(read_only=True)

    class Meta:
        model = Profile
        fields = (
            "name",
            "headline",
            "target_role",
            "location",
            "email",
            "phone",
            "availability",
            "hero_eyebrow",
            "about_heading",
            "bio",
            "github_url",
            "linkedin_url",
            "website_url",
            "twitter_url",
            "avatar",
            "resume_url",
            "seo_title",
            "seo_description",
            "canonical_url",
            "og_image",
            "chatbot_greeting",
            "footer_note",
        )

    def get_bio(self, obj: Profile) -> list[str]:
        return obj.bio_paragraphs

    def get_resume_url(self, obj: Profile) -> str | None:
        if not obj.resume:
            return None
        request = self.context.get("request")
        url = obj.resume.url
        return request.build_absolute_uri(url) if request else url


# ---------------------------------------------------------------------------
# Admin serializers (full CRUD)
# ---------------------------------------------------------------------------


class AdminProfileSerializer(serializers.ModelSerializer):
    bio_paragraphs = serializers.ListField(read_only=True)
    resume_url = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        exclude = ("id",)
        read_only_fields = ("updated_at",)

    def get_resume_url(self, obj: Profile) -> str | None:
        if not obj.resume:
            return None
        request = self.context.get("request")
        url = obj.resume.url
        return request.build_absolute_uri(url) if request else url


class SkillCategoryAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = SkillCategory
        fields = "__all__"


class SkillAdminSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Skill
        fields = "__all__"


class ProjectScreenshotAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectScreenshot
        fields = "__all__"


class ProjectAdminSerializer(serializers.ModelSerializer):
    tech = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = "__all__"
        read_only_fields = ("created_at", "updated_at")

    def get_tech(self, obj: Project) -> list[str]:
        return obj.tech_list

    def get_cover_image_url(self, obj: Project) -> str | None:
        if not obj.cover_image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.cover_image.url) if request else obj.cover_image.url


class EducationAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Education
        fields = "__all__"


class ExperienceAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Experience
        fields = "__all__"


class CertificationAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Certification
        fields = "__all__"


class AchievementAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Achievement
        fields = "__all__"


class FAQAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQ
        fields = "__all__"


class SocialLinkAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialLink
        fields = "__all__"


class SuggestedQuestionAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = SuggestedQuestion
        fields = "__all__"


class ContactMessageAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = "__all__"
        read_only_fields = (
            "name",
            "email",
            "subject",
            "message",
            "created_at",
            "ip_hash",
            "user_agent",
        )


class ChatLogAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatLog
        fields = "__all__"
        read_only_fields = (
            "question",
            "answer",
            "sources",
            "provider",
            "latency_ms",
            "session_id",
            "flagged",
            "created_at",
        )


class ContactMessageCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, min_length=2)
    email = serializers.EmailField()
    subject = serializers.CharField(max_length=200, required=False, allow_blank=True)
    message = serializers.CharField(max_length=5000, min_length=10)
    # Honeypot: real users never fill this hidden field.
    website = serializers.CharField(required=False, allow_blank=True, write_only=True)


class TokenUserSerializer(serializers.Serializer):
    username = serializers.CharField()
    email = serializers.EmailField(allow_blank=True)
    first_name = serializers.CharField(allow_blank=True)
    last_name = serializers.CharField(allow_blank=True)
    is_staff = serializers.BooleanField()
