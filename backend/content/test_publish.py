"""Publishing pipeline tests: signals, debounce, admin trigger and failures."""

from __future__ import annotations

import json
import sys
import time
from unittest.mock import MagicMock, patch
from urllib.error import URLError

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient

from .models import ChatLog, ContactMessage, Project, SiteRebuild
from .publish import (
    HOOK_TIMEOUT_SECONDS,
    _post_to_hook,
    log_configuration,
    request_site_rebuild,
    suppress_site_rebuilds,
)

User = get_user_model()
HOOK = "https://hooks.example/rebuild/secret-token"


class RebuildSignalTests(TestCase):
    def setUp(self) -> None:
        self.project = Project.objects.create(
            title="Signal Test Project",
            summary="A visible project used to exercise rebuild signals.",
        )
        self.client = APIClient()

    def _clear_debounce(self) -> None:
        SiteRebuild.objects.all().delete()

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.publish._dispatch")
    def test_dispatch_waits_for_the_database_commit(self, dispatch) -> None:
        with self.captureOnCommitCallbacks(execute=False):
            self.project.summary = "Committed later"
            self.project.save()

        self.assertEqual(dispatch.call_count, 0)

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.publish._dispatch")
    def test_several_rapid_edits_dispatch_once(self, dispatch) -> None:
        for index in range(4):
            self.project.summary = f"Rapid edit {index}"
            with self.captureOnCommitCallbacks(execute=True):
                self.project.save()

        self.assertEqual(dispatch.call_count, 1)
        self.assertIsNotNone(SiteRebuild.objects.get(pk=1).last_requested_at)

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.publish._dispatch")
    def test_unchanged_save_does_not_dispatch(self, dispatch) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            self.project.save()

        self.assertEqual(dispatch.call_count, 0)

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.publish._dispatch")
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
    @patch("content.publish._dispatch")
    def test_unpublishing_a_visible_row_dispatches(self, dispatch) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            self.project.visible = False
            self.project.save()
        self.assertEqual(dispatch.call_count, 1)

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.publish._dispatch")
    def test_visible_create_dispatches(self, dispatch) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            Project.objects.create(
                title="Fresh published project",
                summary="This row changes the rendered site.",
            )
        self.assertEqual(dispatch.call_count, 1)

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.publish._dispatch")
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
    @patch("content.publish._dispatch")
    def test_visible_delete_dispatches(self, dispatch) -> None:
        self._clear_debounce()
        with self.captureOnCommitCallbacks(execute=True):
            self.project.delete()
        self.assertEqual(dispatch.call_count, 1)

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.publish._dispatch")
    def test_contact_messages_and_chat_logs_never_dispatch(self, dispatch) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            ContactMessage.objects.create(
                name="Recruiter",
                email="recruiter@example.com",
                subject="Hello",
                message="Are you available for an internship?",
            )
            ChatLog.objects.create(
                question="What projects has Vishnu built?",
                answer="Several security projects.",
                provider="extractive",
            )
        self.assertEqual(dispatch.call_count, 0)

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.publish._dispatch")
    def test_management_commands_are_skipped(self, dispatch) -> None:
        with patch.object(sys, "argv", ["manage.py", "migrate"]):
            with self.captureOnCommitCallbacks(execute=True):
                self.project.summary = "Edited while a migration ran"
                self.project.save()

        self.assertEqual(dispatch.call_count, 0)

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.publish._dispatch")
    def test_explicit_suppression_skips_a_save(self, dispatch) -> None:
        with suppress_site_rebuilds():
            with self.captureOnCommitCallbacks(execute=True):
                self.project.summary = "Bulk write"
                self.project.save()

        self.assertEqual(dispatch.call_count, 0)

    @override_settings(SITE_REBUILD_HOOK_URL="")
    @patch("content.publish._dispatch")
    def test_unset_hook_is_a_noop(self, dispatch) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            self.project.summary = "No hook configured"
            self.project.save()

        self.assertEqual(dispatch.call_count, 0)
        self.assertFalse(SiteRebuild.objects.exists())

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.publish._dispatch")
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

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.publish._post_to_hook", side_effect=lambda url: time.sleep(1.5))
    def test_slow_hook_never_blocks_the_admin_save(self, post) -> None:
        started = time.monotonic()
        with self.captureOnCommitCallbacks(execute=True):
            self.project.summary = "Saved while the hook hangs"
            self.project.save()
        self.assertLess(time.monotonic() - started, 0.75)

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.publish.request.urlopen")
    def test_hook_uses_a_post_and_does_not_log_the_url(self, urlopen) -> None:
        response = MagicMock()
        response.__enter__.return_value.status = 202
        urlopen.return_value = response

        with self.assertLogs("content.rebuild", level="INFO") as captured:
            _post_to_hook(HOOK)

        hook_request = urlopen.call_args.args[0]
        self.assertEqual(hook_request.get_method(), "POST")
        self.assertEqual(hook_request.full_url, HOOK)
        self.assertEqual(urlopen.call_args.kwargs["timeout"], HOOK_TIMEOUT_SECONDS)
        output = "\n".join(captured.output)
        self.assertIn("status=202", output)
        self.assertNotIn("secret-token", output)
        self.assertNotIn("hooks.example", output)

    @patch(
        "content.publish.request.urlopen",
        side_effect=URLError("no route"),
    )
    def test_hook_retries_a_network_failure_once(self, urlopen) -> None:
        with self.assertLogs("content.rebuild", level="WARNING") as captured:
            _post_to_hook(HOOK)

        self.assertEqual(urlopen.call_count, 2)
        output = "\n".join(captured.output)
        self.assertIn("URLError", output)
        self.assertNotIn("secret-token", output)
        self.assertNotIn("hooks.example", output)

    @patch(
        "content.publish.request.urlopen",
        side_effect=TimeoutError("timed out"),
    )
    def test_hook_timeout_is_bounded_and_retried(self, urlopen) -> None:
        _post_to_hook(HOOK)

        self.assertEqual(urlopen.call_count, 2)
        self.assertTrue(
            all(
                call.kwargs["timeout"] == HOOK_TIMEOUT_SECONDS
                for call in urlopen.call_args_list
            )
        )

    @patch("content.publish.request.urlopen")
    def test_http_error_is_not_retried(self, urlopen) -> None:
        from urllib.error import HTTPError

        urlopen.side_effect = HTTPError(HOOK, 500, "boom", {}, None)  # type: ignore[arg-type]

        with self.assertLogs("content.rebuild", level="WARNING") as captured:
            _post_to_hook(HOOK)

        self.assertEqual(urlopen.call_count, 1)
        self.assertIn("status=500", "\n".join(captured.output))

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    @patch("content.publish._dispatch")
    def test_reason_is_logged_without_the_url(self, dispatch) -> None:
        with self.assertLogs("content.rebuild", level="INFO") as captured:
            request_site_rebuild("unit_test_reason", force=True)

        output = "\n".join(captured.output)
        self.assertIn("unit_test_reason", output)
        self.assertNotIn("secret-token", output)
        self.assertNotIn("hooks.example", output)

    @override_settings(SITE_REBUILD_HOOK_URL="")
    def test_startup_log_reports_disabled_auto_publish(self) -> None:
        with patch("content.publish._configuration_logged", False):
            with self.assertLogs("content.rebuild", level="INFO") as captured:
                log_configuration()

        output = "\n".join(captured.output)
        self.assertIn("auto-publish disabled", output)
        self.assertNotIn("secret-token", output)

    @override_settings(SITE_REBUILD_HOOK_URL=HOOK)
    def test_startup_log_never_contains_the_hook_url(self) -> None:
        with patch("content.publish._configuration_logged", False):
            with self.assertLogs("content.rebuild", level="INFO") as captured:
                log_configuration()

        self.assertIn("auto-publish enabled", "\n".join(captured.output))
        self.assertNotIn("secret-token", "\n".join(captured.output))


@override_settings(SITE_REBUILD_HOOK_URL=HOOK)
class PublishEndpointTests(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.staff = User.objects.create_user(
            username="publisher",
            password="a-strong-password-123",
            is_staff=True,
        )
        cls.viewer = User.objects.create_user(
            username="viewer",
            password="a-strong-password-123",
            is_staff=False,
        )

    def setUp(self) -> None:
        # DRF throttles keep their counters in the cache, outside the test
        # transaction; reset them so tests are independent.
        cache.clear()
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    @patch("content.publish._dispatch")
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
    @patch("content.publish._dispatch")
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

        self.client.force_authenticate(user=self.viewer)
        response = self.client.post("/api/v1/admin/publish/", format="json")
        self.assertEqual(response.status_code, 403)

    @patch("content.publish._dispatch")
    def test_publish_is_throttled_to_six_per_hour(self, dispatch) -> None:
        for _ in range(6):
            allowed = self.client.post("/api/v1/admin/publish/", format="json")
            self.assertEqual(allowed.status_code, 200)

        blocked = self.client.post("/api/v1/admin/publish/", format="json")
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(dispatch.call_count, 6)

    @patch("content.publish._dispatch")
    def test_responses_and_logs_never_contain_the_hook_url(self, dispatch) -> None:
        publish = self.client.post("/api/v1/admin/publish/", format="json")
        dashboard = self.client.get("/api/v1/admin/dashboard/")

        for response in (publish, dashboard):
            body = json.dumps(response.data, default=str)
            self.assertNotIn("secret-token", body)
            self.assertNotIn("hooks.example", body)
            self.assertNotIn("SITE_REBUILD_HOOK_URL=", body)


@override_settings(SITE_REBUILD_HOOK_URL=HOOK)
class SeedCommandTests(TransactionTestCase):
    """Bulk seeding must never enqueue a build, even though it really commits."""

    @patch("content.publish._dispatch")
    def test_seed_portfolio_does_not_request_a_rebuild(self, dispatch) -> None:
        call_command("seed_portfolio", verbosity=0)

        self.assertEqual(dispatch.call_count, 0)
        self.assertTrue(Project.objects.exists())
