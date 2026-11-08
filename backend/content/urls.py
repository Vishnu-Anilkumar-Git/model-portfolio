from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

router = DefaultRouter()
# Register the more specific nested paths before their parents so "screenshots"
# and "categories" are never parsed as primary keys.
router.register(
    "admin/projects/screenshots",
    views.ProjectScreenshotViewSet,
    basename="admin-project-screenshots",
)
router.register(
    "admin/skills/categories",
    views.SkillCategoryViewSet,
    basename="admin-skill-categories",
)
router.register("admin/projects", views.ProjectViewSet, basename="admin-projects")
router.register("admin/skills", views.SkillViewSet, basename="admin-skills")
router.register("admin/education", views.EducationViewSet, basename="admin-education")
router.register("admin/experience", views.ExperienceViewSet, basename="admin-experience")
router.register(
    "admin/certifications", views.CertificationViewSet, basename="admin-certifications"
)
router.register(
    "admin/achievements", views.AchievementViewSet, basename="admin-achievements"
)
router.register("admin/faqs", views.FAQViewSet, basename="admin-faqs")
router.register(
    "admin/social-links", views.SocialLinkViewSet, basename="admin-social-links"
)
router.register(
    "admin/chatbot/suggestions",
    views.SuggestedQuestionViewSet,
    basename="admin-suggested-questions",
)
router.register(
    "admin/messages", views.ContactMessageViewSet, basename="admin-messages"
)
router.register("admin/chat-logs", views.ChatLogViewSet, basename="admin-chat-logs")

urlpatterns = [
    path("site/", views.SiteView.as_view(), name="site"),
    path(
        "projects/<slug:slug>/",
        views.PublicProjectDetailView.as_view(),
        name="project-detail",
    ),
    path("health/", views.HealthView.as_view(), name="health"),
    path("sitemap.xml", views.SitemapView.as_view(), name="sitemap"),
    path("robots.txt", views.RobotsView.as_view(), name="robots"),
    path("contact/", views.ContactCreateView.as_view(), name="contact"),
    path("auth/token/", views.LoginView.as_view(), name="token-obtain"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", views.MeView.as_view(), name="auth-me"),
    path("admin/profile/", views.AdminProfileView.as_view(), name="admin-profile"),
    path("admin/dashboard/", views.DashboardView.as_view(), name="admin-dashboard"),
    path("admin/publish/", views.PublishSiteView.as_view(), name="admin-publish"),
    path("", include(router.urls)),
]
