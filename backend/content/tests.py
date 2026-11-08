from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import ContactMessage, Profile, Project

User = get_user_model()


class PortfolioAPITestCase(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        call_command("seed_portfolio", verbosity=0)

    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient()

    # -- public site -----------------------------------------------------

    def test_site_payload_contains_every_section(self) -> None:
        response = self.client.get("/api/v1/site/")
        self.assertEqual(response.status_code, 200)
        for key in (
            "profile",
            "stats",
            "socials",
            "skills",
            "projects",
            "education",
            "experience",
            "certifications",
            "achievements",
            "faqs",
            "suggested_questions",
            "seo",
        ):
            self.assertIn(key, response.data)

        self.assertEqual(response.data["profile"]["name"], "Vishnu Anilkumar")
        self.assertEqual(len(response.data["projects"]), 13)
        self.assertEqual(len(response.data["certifications"]), 10)

    def test_stats_match_database(self) -> None:
        response = self.client.get("/api/v1/site/")
        stats = {item["label"]: item["value"] for item in response.data["stats"]}
        self.assertEqual(
            int(stats["Projects Shipped"]),
            Project.objects.filter(status=Project.Status.COMPLETED).count(),
        )
        self.assertEqual(
            int(stats["In Active Development"]),
            Project.objects.filter(status=Project.Status.ONGOING).count(),
        )
        self.assertEqual(stats["Target Role"], Profile.load().target_role)

    def test_project_detail_and_hidden_projects(self) -> None:
        project = Project.objects.get(slug="asi-ai-security-platform")
        response = self.client.get(f"/api/v1/projects/{project.slug}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], project.title)
        self.assertIn("description", response.data)

        project.visible = False
        project.save()
        hidden = self.client.get(f"/api/v1/projects/{project.slug}/")
        self.assertEqual(hidden.status_code, 404)

    def test_json_ld_is_generated_from_content(self) -> None:
        response = self.client.get("/api/v1/site/")
        types = [schema["@type"] for schema in response.data["seo"]["json_ld"]]
        self.assertIn("Person", types)
        self.assertIn("FAQPage", types)

    def test_sitemap_is_generated_from_visible_projects(self) -> None:
        response = self.client.get("/api/v1/sitemap.xml")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response["Content-Type"].startswith("application/xml"))
        body = response.content.decode()
        self.assertIn("<urlset", body)
        for project in Project.objects.filter(visible=True)[:3]:
            self.assertIn(f"/projects/{project.slug}", body)

        hidden = Project.objects.first()
        hidden.visible = False
        hidden.save(update_fields=["visible"])
        refreshed = self.client.get("/api/v1/sitemap.xml").content.decode()
        self.assertNotIn(f"/projects/{hidden.slug}", refreshed)

    def test_robots_points_at_the_sitemap(self) -> None:
        response = self.client.get("/api/v1/robots.txt")
        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn("Sitemap: http", body)
        self.assertIn("/sitemap.xml", body)
        self.assertIn("Disallow: /admin/", body)

    # -- contact ---------------------------------------------------------

    def test_contact_message_is_stored(self) -> None:
        response = self.client.post(
            "/api/v1/contact/",
            {
                "name": "Recruiter",
                "email": "recruiter@example.com",
                "subject": "SOC role",
                "message": "We have an entry-level SOC opening in Kochi.",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(ContactMessage.objects.count(), 1)
        self.assertEqual(ContactMessage.objects.get().email, "recruiter@example.com")

    def test_contact_honeypot_is_silently_accepted(self) -> None:
        response = self.client.post(
            "/api/v1/contact/",
            {
                "name": "Bot",
                "email": "bot@example.com",
                "message": "Buy my backlinks right now please.",
                "website": "https://spam.example",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(ContactMessage.objects.count(), 0)

    def test_contact_rejects_invalid_email(self) -> None:
        response = self.client.post(
            "/api/v1/contact/",
            {"name": "A", "email": "not-an-email", "message": "short"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_contact_is_rate_limited(self) -> None:
        payload = {
            "name": "Recruiter",
            "email": "recruiter@example.com",
            "message": "A legitimate message long enough to pass validation.",
        }
        for _ in range(5):
            self.assertEqual(
                self.client.post("/api/v1/contact/", payload, format="json").status_code,
                201,
            )
        blocked = self.client.post("/api/v1/contact/", payload, format="json")
        self.assertEqual(blocked.status_code, 429)
        self.assertIn("retry_after", blocked.data)

    # -- auth ------------------------------------------------------------

    def test_jwt_login_returns_tokens_and_user(self) -> None:
        User.objects.create_user(
            username="vishnu", password="a-strong-password-123", is_staff=True
        )
        response = self.client.post(
            "/api/v1/auth/token/",
            {"username": "vishnu", "password": "a-strong-password-123"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertTrue(response.data["user"]["is_staff"])

    def test_admin_requires_authentication(self) -> None:
        response = self.client.get("/api/v1/admin/dashboard/")
        self.assertEqual(response.status_code, 401)

    def test_non_staff_cannot_use_admin_api(self) -> None:
        user = User.objects.create_user(username="visitor", password="password-123")
        self.client.force_authenticate(user=user)
        response = self.client.get("/api/v1/admin/projects/")
        self.assertEqual(response.status_code, 403)

    def test_staff_can_crud_projects(self) -> None:
        staff = User.objects.create_user(
            username="staff", password="password-123", is_staff=True
        )
        self.client.force_authenticate(user=staff)

        created = self.client.post(
            "/api/v1/admin/projects/",
            {
                "title": "Test Project",
                "summary": "A project created in a test.",
                "status": "ongoing",
                "tech_stack": "Python, Django",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        project_id = created.data["id"]
        self.assertTrue(created.data["slug"])

        updated = self.client.patch(
            f"/api/v1/admin/projects/{project_id}/",
            {"progress": 40},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["progress"], 40)

        deleted = self.client.delete(f"/api/v1/admin/projects/{project_id}/")
        self.assertEqual(deleted.status_code, 204)

    def test_profile_is_a_singleton(self) -> None:
        first = Profile.load()
        second = Profile.load()
        self.assertEqual(Profile.objects.count(), 1)
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(second.pk, 1)

    def test_dashboard_reports_content_gaps(self) -> None:
        staff = User.objects.create_user(
            username="staff", password="password-123", is_staff=True
        )
        self.client.force_authenticate(user=staff)
        response = self.client.get("/api/v1/admin/dashboard/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("completeness", response.data)
        gaps = {item["key"]: item["done"] for item in response.data["completeness"]}
        self.assertFalse(gaps["resume"])
        self.assertFalse(gaps["experience"])

    def test_contact_messages_can_be_marked_read(self) -> None:
        staff = User.objects.create_user(
            username="staff", password="password-123", is_staff=True
        )
        message = ContactMessage.objects.create(
            name="Recruiter",
            email="recruiter@example.com",
            message="Hello there, this is a test.",
        )
        self.client.force_authenticate(user=staff)
        response = self.client.patch(
            f"/api/v1/admin/messages/{message.pk}/", {"is_read": True}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        message.refresh_from_db()
        self.assertTrue(message.is_read)


@override_settings(
    ALLOWED_HOSTS=["testserver", "localhost"],
    CORS_ALLOWED_ORIGINS=["http://localhost:5173"],
)
class CorsTest(TestCase):
    def test_configured_origin_is_allowed_and_unknown_is_not(self) -> None:
        client = APIClient()
        allowed = client.options(
            "/api/v1/site/",
            HTTP_ORIGIN="http://localhost:5173",
            HTTP_HOST="testserver",
        )
        self.assertEqual(
            allowed.headers.get("Access-Control-Allow-Origin"),
            "http://localhost:5173",
        )

        rejected = client.options(
            "/api/v1/site/",
            HTTP_ORIGIN="https://evil.example",
            HTTP_HOST="testserver",
        )
        self.assertNotIn("Access-Control-Allow-Origin", rejected.headers)
