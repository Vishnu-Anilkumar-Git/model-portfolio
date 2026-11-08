from django.contrib import admin
from django.utils.html import format_html

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


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "headline", "email", "updated_at")

    def has_add_permission(self, request: object) -> bool:
        return not Profile.objects.exists()

    def has_delete_permission(self, request: object, obj: object = None) -> bool:
        return False


@admin.register(SocialLink)
class SocialLinkAdmin(admin.ModelAdmin):
    list_display = ("label", "icon", "url", "order", "visible")
    list_editable = ("order", "visible")
    list_filter = ("icon", "visible")


class SkillInline(admin.TabularInline):
    model = Skill
    extra = 1
    fields = ("name", "level", "order", "visible")


@admin.register(SkillCategory)
class SkillCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "order", "visible")
    list_editable = ("order", "visible")
    inlines = [SkillInline]


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "level", "order", "visible")
    list_editable = ("level", "order", "visible")
    list_filter = ("category", "visible")
    search_fields = ("name",)


class ProjectScreenshotInline(admin.TabularInline):
    model = ProjectScreenshot
    extra = 1
    fields = ("image", "caption", "order")


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("title", "status", "progress", "featured", "order", "visible")
    list_editable = ("status", "featured", "order", "visible")
    list_filter = ("status", "featured", "visible", "accent")
    search_fields = ("title", "summary", "tech_stack")
    prepopulated_fields = {"slug": ("title",)}
    inlines = [ProjectScreenshotInline]
    fieldsets = (
        (
            "Card",
            {
                "fields": (
                    "title",
                    "slug",
                    "subtitle",
                    "summary",
                    "status",
                    "progress",
                    "tech_stack",
                    "accent",
                    "featured",
                    "order",
                    "visible",
                )
            },
        ),
        (
            "Showcase",
            {
                "fields": (
                    "description",
                    "highlights",
                    "learnings",
                    "cover_image",
                    "architecture_image",
                    "architecture_notes",
                    "repo_url",
                    "demo_url",
                )
            },
        ),
        (
            "Dates & SEO",
            {
                "fields": ("started_on", "completed_on", "meta_description"),
                "classes": ("collapse",),
            },
        ),
    )

    def cover_preview(self, obj: Project) -> str:
        if not obj.cover_image:
            return "—"
        return format_html(
            '<img src="{}" style="height:40px;border-radius:4px" />', obj.cover_image.url
        )


@admin.register(Education)
class EducationAdmin(admin.ModelAdmin):
    list_display = ("degree", "institution", "start_year", "end_year", "current", "visible")
    list_editable = ("current", "visible")
    search_fields = ("degree", "institution", "university")


@admin.register(Experience)
class ExperienceAdmin(admin.ModelAdmin):
    list_display = ("role", "organization", "kind", "period", "current", "visible")
    list_editable = ("current", "visible")
    list_filter = ("kind", "visible")
    search_fields = ("role", "organization")


@admin.register(Certification)
class CertificationAdmin(admin.ModelAdmin):
    list_display = ("name", "issuer", "status", "category", "visible")
    list_editable = ("status", "category", "visible")
    list_filter = ("status", "category", "visible")
    search_fields = ("name", "issuer")


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ("title", "organization", "category", "occurred_on", "visible")
    list_editable = ("category", "visible")
    list_filter = ("category", "visible")
    search_fields = ("title", "organization")


@admin.register(FAQ)
class FAQAdmin(admin.ModelAdmin):
    list_display = ("question", "order", "visible")
    list_editable = ("order", "visible")
    search_fields = ("question", "answer")


@admin.register(SuggestedQuestion)
class SuggestedQuestionAdmin(admin.ModelAdmin):
    list_display = ("text", "order", "visible")
    list_editable = ("order", "visible")


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "subject", "created_at", "is_read")
    list_filter = ("is_read", "created_at")
    search_fields = ("name", "email", "subject", "message")
    readonly_fields = ("name", "email", "subject", "message", "created_at", "ip_hash", "user_agent")
    actions = ["mark_read"]

    @admin.action(description="Mark selected messages as read")
    def mark_read(self, request: object, queryset: object) -> None:
        queryset.update(is_read=True)  # type: ignore[attr-defined]


@admin.register(ChatLog)
class ChatLogAdmin(admin.ModelAdmin):
    list_display = ("question", "provider", "flagged", "latency_ms", "created_at")
    list_filter = ("provider", "flagged", "created_at")
    search_fields = ("question", "answer")
    readonly_fields = [f.name for f in ChatLog._meta.fields]

    def has_add_permission(self, request: object) -> bool:
        return False

    def has_change_permission(self, request: object, obj: object = None) -> bool:
        return False
