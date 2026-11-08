"""Publishing pipeline tests: signals, debounce, admin trigger and failures."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from urllib.error import URLError

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Project, SiteRebuild
from .rebuild import _post_to_hook

User = get_user_model()
HOOK = "https://hooks.example/rebuild/secret-token"


class RebuildSignalTests(TestCase):
    def setUp(self) -> None:
        self.project = Project.objects.create(
            title="Signal Test Project",
            summary="A visible project used to exercise rebuild signals.",
        )
        # The row was created before any override in the individual tests.
        self.client = APIClient()

    def _clear_debounce(self) -> None:
        SiteRebuild.objects.all().delete()

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.rebuild._dispatch")
    def test_dispatch_waits_for_the_database_commit(self, dispatch) -> None:
        with self.captureOnCommitCallbacks(execute=False):
            self.project.summary = "Committed later"
            self.project.save()

        self.assertEqual(dispatch.call_count, 0)

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.rebuild._dispatch")
    def test_several_rapid_edits_dispatch_once(self, dispatch) -> None:
        for index in range(4):
            self.project.summary = f"Rapid edit {index}"
            with self.captureOnCommitCallbacks(execute=True):
                self.project.save()

        self.assertEqual(dispatch.call_count, 1)
        self.assertIsNotNone(SiteRebuild.objects.get(pk=1).last_requested_at)

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.rebuild._dispatch")
    def test_hidden_edits_do_not_dispatch_until_visible(self, dispatch) -> None:
        Project.objects.filter(pk=self.project.pk).update(visible=False)
        self.project.refresh_from_db()

        with self.captureOnCommitCallbacks(execute=True):
            self.project.summary = "Draft-only wording"
            self.project.save()
        self.assertEqual(dispatch.call_count, 0)
        self.assertFalse(SiteRebuild.objects.exists())

        Project.objects.filter(pk=self.project.pk).update(visible=True)
        self.project.refresh_from_db()
        with self.captureOnCommitCallbacks(execute=True):
            self.project.summary = "Published wording"
            self.project.save()
        self.assertEqual(dispatch.call_count, 1)

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.rebuild._dispatch")
    def test_unpublishing_a_visible_row_dispatches(self, dispatch) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            self.project.visible = False
            self.project.save()
        self.assertEqual(dispatch.call_count, 1)

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.rebuild._dispatch")
    def test_visible_create_dispatches(self, dispatch) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            Project.objects.create(
                title="Fresh published project",
                summary="This row changes the rendered site.",
            )
        self.assertEqual(dispatch.call_count, 1)

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.rebuild._dispatch")
    def test_hidden_create_and_delete_are_noops(self, dispatch) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            hidden = Project.objects.create(
                title="Hidden draft",
                summary="Not part of the public output yet.",
                visible=False,
            )
        self.assertEqual(dispatch.call_count, 0)

        with self.captureOnCommitCallbacks(execute=True):
            hidden.delete()
        self.assertEqual(dispatch.call_count, 0)

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.rebuild._dispatch")
    def test_visible_delete_dispatches(self, dispatch) -> None:
        self._clear_debounce()
        with self.captureOnCommitCallbacks(execute=True):
            self.project.delete()
        self.assertEqual(dispatch.call_count, 1)

    @override_settings(SITE_REBUILD_HOOK_URL="")
    @patch("content.rebuild._dispatch")
    def test_unset_hook_is_a_noop(self, dispatch) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            self.project.summary = "No hook configured"
            self.project.save()

        self.assertEqual(dispatch.call_count, 0)
        self.assertFalse(SiteRebuild.objects.exists())

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.rebuild._dispatch")
    def test_dispatch_failure_does_not_break_admin_save(self, dispatch) -> None:
        dispatch.side_effect = RuntimeError("thread unavailable")
        staff = User.objects.create_user(
            username="staff", password="a-strong-password-123", is_staff=True
        )
        self.client.force_authenticate(user=staff)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                f"/api/v1/admin/projects/{self.project.pk}/",
                {"subtitle": "Saved even if publishing failed"},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.project.refresh_from_db()
        self.assertEqual(self.project.subtitle, "Saved even if publishing failed")

    @patch("content.rebuild.request.urlopen")
    def test_hook_uses_a_post_and_does_not_log_the_url(self, urlopen) -> None:
        response = MagicMock()
        response.__enter__.return_value.status = 202
        urlopen.return_value = response

        with self.assertLogs("content.rebuild", level="INFO") as captured:
            _post_to_hook(HOOK)

        hook_request = urlopen.call_args.args[0]
        self.assertEqual(hook_request.get_method(), "POST")
        self.assertEqual(hook_request.full_url, HOOK)
        output = "\n".join(captured.output)
        self.assertNotIn("secret-token", output)
        self.assertNotIn("hooks.example", output)

    @patch("content.rebuild.request.urlopen", side_effect=URLError("no route"))
    def test_hook_failure_logs_without_the_url(self, urlopen) -> None:
        with self.assertLogs("content.rebuild", level="WARNING") as captured:
            _post_to_hook(HOOK)

        output = "\n".join(captured.output)
        self.assertIn("URLError", output)
        self.assertNotIn("secret-token", output)
        self.assertNotIn("hooks.example", output)


@override_settings(SITE_REBUILD_HOOK_URL=HOOK)
class PublishEndpointTests(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.staff = User.objects.create_user(
            username="publisher",
            password="a-strong-password-123",
            is_staff=True,
        )

    def setUp(self) -> None:
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    @patch("content.rebuild._dispatch")
    def test_publish_button_bypasses_the_automatic_debounce(self, dispatch) -> None:
        first = self.client.post("/api/v1/admin/publish/", format="json")
        self.assertEqual(first.status_code, 200)
        self.assertTrue(first.data["requested"])
        self.assertTrue(first.data["configured"])
        self.assertEqual(first.data["reason"], "requested")
        self.assertIsNotNone(first.data["last_requested_at"])
        self.assertEqual(dispatch.call_count, 1)

        second = self.client.post("/api/v1/admin/publish/", format="json")
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.data["requested"])
        self.assertEqual(second.data["reason"], "requested")
        self.assertEqual(dispatch.call_count, 2)

        dashboard = self.client.get("/api/v1/admin/dashboard/")
        self.assertEqual(dashboard.status_code, 200)
        self.assertEqual(
            dashboard.data["rebuild"]["last_requested_at"],
            second.data["last_requested_at"],
        )

    @override_settings(SITE_REBUILD_HOOK_URL="")
    @patch("content.rebuild._dispatch")
    def test_publish_button_without_hook_is_a_noop(self, dispatch) -> None:
        response = self.client.post("/api/v1/admin/publish/", format="json")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["requested"])
        self.assertFalse(response.data["configured"])
        self.assertEqual(dispatch.call_count, 0)

    def test_publish_requires_staff(self) -> None:
        self.client.force_authenticate(user=None)
        response = self.client.post("/api/v1/admin/publish/", format="json")
        self.assertEqual(response.status_code, 401)
