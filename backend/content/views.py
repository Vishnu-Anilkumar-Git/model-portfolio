from __future__ import annotations

import hashlib
import logging
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.core.mail import send_mail
from django.http import HttpResponse
from django.db import connection
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView

from .audit import client_ip, log_admin_action

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
from .rebuild import rebuild_status, request_site_rebuild
from .seo import faq_schema, person_schema, website_schema
from .sitemap import build_robots, build_sitemap
from .serializers import (
    AchievementAdminSerializer,
    AchievementPublicSerializer,
    AdminProfileSerializer,
    CertificationAdminSerializer,
    CertificationPublicSerializer,
    ChatLogAdminSerializer,
    ContactMessageAdminSerializer,
    ContactMessageCreateSerializer,
    EducationAdminSerializer,
    EducationPublicSerializer,
    ExperienceAdminSerializer,
    ExperiencePublicSerializer,
    FAQAdminSerializer,
    FAQPublicSerializer,
    ProfilePublicSerializer,
    ProjectAdminSerializer,
    ProjectDetailSerializer,
    ProjectListSerializer,
    ProjectScreenshotAdminSerializer,
    SkillAdminSerializer,
    SkillCategoryAdminSerializer,
    SkillCategoryPublicSerializer,
    SkillPublicSerializer,
    SocialLinkAdminSerializer,
    SocialLinkPublicSerializer,
    SuggestedQuestionAdminSerializer,
    SuggestedQuestionSerializer,
    TokenUserSerializer,
)

logger = logging.getLogger(__name__)
security_logger = logging.getLogger("content.security")


# ---------------------------------------------------------------------------
# Public read API
# ---------------------------------------------------------------------------


def visible_projects() -> Any:
    return Project.objects.filter(visible=True).prefetch_related("screenshots")


class SiteView(APIView):
    """One request that hydrates the whole public site."""

    permission_classes = [AllowAny]

    def get(self, request: Any) -> Response:
        profile = Profile.load()
        context = {"request": request}

        categories = (
            SkillCategory.objects.filter(visible=True)
            .prefetch_related("skills")
            .order_by("order", "pk")
        )
        projects = list(visible_projects().order_by("order", "pk"))
        education = list(Education.objects.filter(visible=True).order_by("order", "pk"))
        experience = list(Experience.objects.filter(visible=True).order_by("order", "pk"))
        certifications = list(
            Certification.objects.filter(visible=True).order_by("order", "pk")
        )
        achievements = list(
            Achievement.objects.filter(visible=True).order_by("order", "pk")
        )
        faqs = list(FAQ.objects.filter(visible=True).order_by("order", "pk"))
        socials = list(SocialLink.objects.filter(visible=True).order_by("order", "pk"))
        suggestions = list(
            SuggestedQuestion.objects.filter(visible=True).order_by("order", "pk")
        )

        in_progress = sum(
            1 for c in certifications if c.status == Certification.Status.IN_PROGRESS
        )
        stats = [
            {
                "label": "Projects Shipped",
                "value": str(
                    sum(
                        1 for p in projects if p.status == Project.Status.COMPLETED
                    )
                ),
            },
            {
                "label": "In Active Development",
                "value": str(
                    sum(1 for p in projects if p.status == Project.Status.ONGOING)
                ),
            },
            {"label": "Certs In Progress", "value": str(in_progress)},
            {"label": "Target Role", "value": profile.target_role},
        ]

        json_ld = [person_schema(profile, [s for c in categories for s in c.skills.all() if s.visible], socials, education), website_schema(profile)]
        faq_ld = faq_schema(faqs)
        if faq_ld:
            json_ld.append(faq_ld)

        og_image = None
        if profile.og_image:
            og_image = request.build_absolute_uri(profile.og_image.url)

        payload: dict[str, Any] = {
            "profile": ProfilePublicSerializer(profile, context=context).data,
            "stats": stats,
            "socials": SocialLinkPublicSerializer(socials, many=True).data,
            "skills": SkillCategoryPublicSerializer(categories, many=True, context=context).data,
            "projects": ProjectListSerializer(projects, many=True, context=context).data,
            "education": EducationPublicSerializer(education, many=True).data,
            "experience": ExperiencePublicSerializer(experience, many=True).data,
            "certifications": CertificationPublicSerializer(
                certifications, many=True
            ).data,
            "achievements": AchievementPublicSerializer(
                achievements, many=True, context=context
            ).data,
            "faqs": FAQPublicSerializer(faqs, many=True).data,
            "suggested_questions": SuggestedQuestionSerializer(
                suggestions, many=True
            ).data,
            "seo": {
                "title": profile.seo_title,
                "description": profile.seo_description,
                "canonical": profile.canonical_url or settings.SITE_URL,
                "og_image": og_image or f"{settings.SITE_URL}/og-cover.jpg",
                "json_ld": json_ld,
            },
            "meta": {
                "generated_at": timezone.now().isoformat(),
                "project_counts": {
                    "completed": sum(
                        1 for p in projects if p.status == Project.Status.COMPLETED
                    ),
                    "ongoing": sum(
                        1 for p in projects if p.status == Project.Status.ONGOING
                    ),
                    "upcoming": sum(
                        1 for p in projects if p.status == Project.Status.UPCOMING
                    ),
                },
            },
        }
        return Response(payload)


class PublicProjectDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request: Any, slug: str) -> Response:
        project = visible_projects().filter(slug=slug).first()
        if not project:
            return Response({"error": "Project not found."}, status=404)
        return Response(
            ProjectDetailSerializer(project, context={"request": request}).data
        )


class SitemapView(APIView):
    permission_classes = [AllowAny]
    throttle_classes: list[Any] = []

    def get(self, request: Any) -> HttpResponse:
        return HttpResponse(build_sitemap(), content_type="application/xml; charset=utf-8")


class RobotsView(APIView):
    permission_classes = [AllowAny]
    throttle_classes: list[Any] = []

    def get(self, request: Any) -> HttpResponse:
        return HttpResponse(
            build_robots(), content_type="text/plain; charset=utf-8"
        )


class HealthView(APIView):
    permission_classes = [AllowAny]
    throttle_classes: list[Any] = []

    def get(self, request: Any) -> Response:
        try:
            connection.ensure_connection()
            database_ok = True
        except Exception:  # pragma: no cover - defensive
            database_ok = False

        return Response(
            {
                "status": "ok" if database_ok else "degraded",
                "database": "ok" if database_ok else "unavailable",
                "time": timezone.now().isoformat(),
            },
            status=200 if database_ok else 503,
        )


# ---------------------------------------------------------------------------
# Contact
# ---------------------------------------------------------------------------


def _client_ip(request: Any) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


class ContactCreateView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "contact"

    def post(self, request: Any) -> Response:
        serializer = ContactMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Honeypot: accept silently so bots do not learn they were caught.
        if data.get("website"):
            return Response(
                {"message": "Thanks — your message has been received."},
                status=status.HTTP_201_CREATED,
            )

        salt = settings.SECRET_KEY[:16]
        ip_hash = hashlib.sha256(
            f"{salt}:{_client_ip(request)}".encode()
        ).hexdigest()

        message = ContactMessage.objects.create(
            name=data["name"],
            email=data["email"],
            subject=data.get("subject", ""),
            message=data["message"],
            ip_hash=ip_hash,
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:300],
        )

        try:
            send_mail(
                subject=f"Portfolio contact: {message.subject or message.name}",
                message=(
                    f"From: {message.name} <{message.email}>\n\n"
                    f"{message.message}"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[settings.CONTACT_NOTIFICATION_EMAIL],
                fail_silently=False,
            )
        except Exception as exc:  # pragma: no cover - depends on email provider
            logger.warning("Contact notification email failed: %s", exc)

        return Response(
            {
                "message": "Thanks — your message has been received. I'll reply by email.",
                "id": message.pk,
            },
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------


class PortfolioTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        data = super().validate(attrs)
        data["user"] = TokenUserSerializer(self.user).data  # type: ignore[arg-type]
        return data


class LoginView(TokenObtainPairView):
    serializer_class = PortfolioTokenObtainPairSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        username = str(request.data.get("username", ""))[:150]
        try:
            response = super().post(request, *args, **kwargs)
        except AuthenticationFailed:
            # Never log the submitted password or the full request body.
            security_logger.warning(
                "login_failed username=%r ip=%s", username, client_ip(request)
            )
            raise
        security_logger.info(
            "login_succeeded username=%r ip=%s", username, client_ip(request)
        )
        return response


class LogoutView(APIView):
    """Blacklist the refresh token so a copied token cannot be replayed."""

    permission_classes = [AllowAny]

    def post(self, request: Any) -> Response:
        token = str(request.data.get("refresh", ""))[:4096]
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                # Already expired, revoked or simply malformed: the client is
                # signing out either way, so do not turn this into an error.
                pass
            except Exception:
                logger.exception("Could not blacklist refresh token")
        return Response({"message": "Signed out."}, status=status.HTTP_200_OK)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Any) -> Response:
        user = request.user
        return Response(
            {
                "id": user.pk,
                "username": user.get_username(),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
            }
        )


# ---------------------------------------------------------------------------
# Admin CRUD
# ---------------------------------------------------------------------------


class AdminPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 500


class AdminBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    pagination_class = AdminPagination
    search_fields: tuple[str, ...] = ()
    filter_fields: tuple[str, ...] = ()
    ordering_fields: tuple[str, ...] = ("order",)

    def perform_create(self, serializer: Any) -> None:
        instance = serializer.save()
        log_admin_action(
            self.request, "create", instance, serializer.validated_data.keys()
        )

    def perform_update(self, serializer: Any) -> None:
        fields = list(serializer.validated_data.keys())
        instance = serializer.save()
        log_admin_action(self.request, "update", instance, fields)

    def perform_destroy(self, instance: Any) -> None:
        log_admin_action(self.request, "delete", instance)
        instance.delete()

    def get_queryset(self) -> Any:
        queryset = super().get_queryset()
        params = self.request.query_params

        search = params.get("search", "").strip()
        if search and self.search_fields:
            condition = Q()
            for field in self.search_fields:
                condition |= Q(**{f"{field}__icontains": search})
            queryset = queryset.filter(condition)

        for field in self.filter_fields:
            value = params.get(field)
            if value not in (None, ""):
                queryset = queryset.filter(**{field: value})

        ordering = params.get("ordering", "").lstrip("-")
        if ordering and ordering in self.ordering_fields:
            prefix = "-" if params.get("ordering", "").startswith("-") else ""
            queryset = queryset.order_by(f"{prefix}{ordering}")
        elif hasattr(queryset.model, "order"):
            queryset = queryset.order_by("order", "pk")

        return queryset


class AdminProfileView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request: Any) -> Response:
        profile = Profile.load()
        return Response(AdminProfileSerializer(profile, context={"request": request}).data)

    def put(self, request: Any) -> Response:
        return self._update(request, partial=False)

    def patch(self, request: Any) -> Response:
        return self._update(request, partial=True)

    def _update(self, request: Any, partial: bool) -> Response:
        profile = Profile.load()
        serializer = AdminProfileSerializer(
            profile,
            data=request.data,
            partial=partial,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        log_admin_action(
            request,
            "update",
            instance,
            request.data.keys() if hasattr(request.data, "keys") else None,
        )
        return Response(serializer.data)


class SkillCategoryViewSet(AdminBaseViewSet):
    queryset = SkillCategory.objects.prefetch_related("skills").all()
    serializer_class = SkillCategoryAdminSerializer
    search_fields = ("name",)
    ordering_fields = ("order", "name")


class SkillViewSet(AdminBaseViewSet):
    queryset = Skill.objects.select_related("category").all()
    serializer_class = SkillAdminSerializer
    search_fields = ("name", "category__name")
    filter_fields = ("category",)
    ordering_fields = ("order", "name", "level")


class ProjectViewSet(AdminBaseViewSet):
    queryset = Project.objects.prefetch_related("screenshots").all()
    serializer_class = ProjectAdminSerializer
    search_fields = ("title", "summary", "tech_stack")
    filter_fields = ("status", "visible", "featured")
    ordering_fields = ("order", "title", "created_at")


class ProjectScreenshotViewSet(AdminBaseViewSet):
    queryset = ProjectScreenshot.objects.select_related("project").all()
    serializer_class = ProjectScreenshotAdminSerializer
    filter_fields = ("project",)
    ordering_fields = ("order",)


class EducationViewSet(AdminBaseViewSet):
    queryset = Education.objects.all()
    serializer_class = EducationAdminSerializer
    search_fields = ("institution", "degree", "university")
    ordering_fields = ("order", "start_year", "end_year")


class ExperienceViewSet(AdminBaseViewSet):
    queryset = Experience.objects.all()
    serializer_class = ExperienceAdminSerializer
    search_fields = ("role", "organization")
    filter_fields = ("kind", "visible")
    ordering_fields = ("order", "start_date")


class CertificationViewSet(AdminBaseViewSet):
    queryset = Certification.objects.all()
    serializer_class = CertificationAdminSerializer
    search_fields = ("name", "issuer")
    filter_fields = ("status", "category", "visible")
    ordering_fields = ("order", "name", "issued_on")


class AchievementViewSet(AdminBaseViewSet):
    queryset = Achievement.objects.all()
    serializer_class = AchievementAdminSerializer
    search_fields = ("title", "organization")
    filter_fields = ("category", "visible")
    ordering_fields = ("order", "occurred_on")


class FAQViewSet(AdminBaseViewSet):
    queryset = FAQ.objects.all()
    serializer_class = FAQAdminSerializer
    search_fields = ("question", "answer")
    filter_fields = ("visible",)
    ordering_fields = ("order",)


class SocialLinkViewSet(AdminBaseViewSet):
    queryset = SocialLink.objects.all()
    serializer_class = SocialLinkAdminSerializer
    search_fields = ("label", "url")
    ordering_fields = ("order", "label")


class SuggestedQuestionViewSet(AdminBaseViewSet):
    queryset = SuggestedQuestion.objects.all()
    serializer_class = SuggestedQuestionAdminSerializer
    search_fields = ("text",)
    ordering_fields = ("order",)


class ContactMessageViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = ContactMessage.objects.all()
    serializer_class = ContactMessageAdminSerializer
    permission_classes = [IsAdminUser]
    pagination_class = AdminPagination
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self) -> Any:
        queryset = super().get_queryset()
        unread = self.request.query_params.get("unread")
        if unread in ("true", "1"):
            queryset = queryset.filter(is_read=False)
        return queryset

    def perform_update(self, serializer: Any) -> None:
        fields = list(serializer.validated_data.keys())
        instance = serializer.save()
        log_admin_action(self.request, "update", instance, fields)

    def perform_destroy(self, instance: Any) -> None:
        log_admin_action(self.request, "delete", instance)
        instance.delete()


class ChatLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ChatLog.objects.all()
    serializer_class = ChatLogAdminSerializer
    permission_classes = [IsAdminUser]
    pagination_class = AdminPagination

    def get_queryset(self) -> Any:
        queryset = super().get_queryset()
        if self.request.query_params.get("flagged") in ("true", "1"):
            queryset = queryset.filter(flagged=True)
        return queryset


class DashboardView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request: Any) -> Response:
        profile = Profile.load()
        week_ago = timezone.now() - timedelta(days=7)

        project_counts = {
            row["status"]: row["count"]
            for row in Project.objects.values("status").annotate(count=Count("id"))
        }

        completeness = [
            {
                "key": "resume",
                "label": "Resume PDF uploaded",
                "done": bool(profile.resume),
                "hint": "Upload it in Profile & site settings.",
            },
            {
                "key": "og_image",
                "label": "Social share image set",
                "done": bool(profile.og_image),
                "hint": "Upload a 1200×630 image in Profile & site settings.",
            },
            {
                "key": "covers",
                "label": "Every project has a cover image",
                "done": not Project.objects.filter(visible=True)
                .filter(Q(cover_image="") | Q(cover_image__isnull=True))
                .exists(),
                "hint": "Add screenshots or a cover image to each project.",
            },
            {
                "key": "experience",
                "label": "At least one experience entry",
                "done": Experience.objects.filter(visible=True).exists(),
                "hint": "Add internships, freelance work or independent projects.",
            },
            {
                "key": "achievements",
                "label": "Labs or achievements listed",
                "done": Achievement.objects.filter(visible=True).exists(),
                "hint": "Add TryHackMe, Hack The Box or CTF progress.",
            },
        ]

        recent_chats = ChatLog.objects.all()[:5]
        recent_messages = ContactMessage.objects.all()[:5]

        return Response(
            {
                "counts": {
                    "projects": Project.objects.count(),
                    "projects_completed": project_counts.get("completed", 0),
                    "projects_ongoing": project_counts.get("ongoing", 0),
                    "projects_upcoming": project_counts.get("upcoming", 0),
                    "skills": Skill.objects.filter(visible=True).count(),
                    "certifications": Certification.objects.count(),
                    "achievements": Achievement.objects.count(),
                    "faqs": FAQ.objects.count(),
                    "unread_messages": ContactMessage.objects.filter(
                        is_read=False
                    ).count(),
                    "chats_7d": ChatLog.objects.filter(created_at__gte=week_ago).count(),
                },
                "completeness": completeness,
                "recent_messages": ContactMessageAdminSerializer(
                    recent_messages, many=True
                ).data,
                "recent_chats": ChatLogAdminSerializer(
                    recent_chats, many=True
                ).data,
                "recent_questions": [
                    {"question": log.question, "created_at": log.created_at}
                    for log in ChatLog.objects.all()[:8]
                ],
                "rebuild": rebuild_status(),
            }
        )


class PublishSiteView(APIView):
    """Manual trigger for the same debounced hosting build hook."""

    permission_classes = [IsAdminUser]

    def post(self, request: Any) -> Response:
        result = request_site_rebuild(force=True)
        messages = {
            "requested": "Rebuild requested. Changes appear after the build finishes.",
            "debounced": (
                "A rebuild was requested recently. Wait for it to finish before "
                "requesting another."
            ),
            "unset": "SITE_REBUILD_HOOK_URL is not configured, so nothing was sent.",
            "error": "Could not request a rebuild. Check the API logs.",
        }
        return Response(
            {
                **rebuild_status(),
                "requested": result.requested,
                "reason": result.reason,
                "message": messages[result.reason],
            }
        )
