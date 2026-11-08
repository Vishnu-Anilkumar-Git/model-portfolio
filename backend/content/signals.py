"""Publish signals for content that can change the static site.

A row only triggers a rebuild when its effective visibility differs from what
it was before the save (or when a visible row is deleted). Editing a hidden
project, skill, or screenshot therefore does not wake the hosting provider.
"""

from __future__ import annotations

import logging
from typing import Any

from django.db import transaction
from django.db.models.signals import post_delete, post_save, pre_save

from .models import (
    Achievement,
    Certification,
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
from .rebuild import request_site_rebuild

logger = logging.getLogger("content.rebuild")

CONTENT_MODELS = (
    Profile,
    SocialLink,
    SkillCategory,
    Skill,
    Project,
    ProjectScreenshot,
    Education,
    Experience,
    Certification,
    Achievement,
    FAQ,
    SuggestedQuestion,
)


def _previous_effective_visible(instance: Any) -> bool:
    """Read the pre-save visibility from the database, including parents."""
    if not instance.pk:
        return False

    if isinstance(instance, Profile):
        return Profile.objects.filter(pk=instance.pk).exists()

    if isinstance(instance, ProjectScreenshot):
        old_project_id = (
            ProjectScreenshot.objects.filter(pk=instance.pk)
            .values_list("project_id", flat=True)
            .first()
        )
        return bool(
            old_project_id
            and Project.objects.filter(pk=old_project_id, visible=True).exists()
        )

    if isinstance(instance, Skill):
        row = (
            Skill.objects.filter(pk=instance.pk)
            .values_list("visible", "category__visible")
            .first()
        )
        return bool(row and row[0] and row[1])

    if hasattr(instance, "visible"):
        return type(instance).objects.filter(pk=instance.pk, visible=True).exists()

    return False


def _effective_visible(instance: Any) -> bool:
    if isinstance(instance, Profile):
        return True

    if isinstance(instance, ProjectScreenshot):
        return bool(
            instance.project_id
            and Project.objects.filter(
                pk=instance.project_id, visible=True
            ).exists()
        )

    if isinstance(instance, Skill):
        return bool(
            instance.visible
            and instance.category_id
            and SkillCategory.objects.filter(
                pk=instance.category_id, visible=True
            ).exists()
        )

    return bool(getattr(instance, "visible", False))


def _schedule_rebuild() -> None:
    """Run after commit, and never let a hook problem break the admin write."""
    try:
        transaction.on_commit(request_site_rebuild)
    except Exception as exc:  # noqa: BLE001 - publishing is best effort
        logger.warning("site_rebuild scheduling failed error=%s", type(exc).__name__)


def _capture_previous_visibility(
    sender: type, instance: Any, **kwargs: object
) -> None:
    instance._site_rebuild_was_visible = _previous_effective_visible(instance)


def _on_content_save(
    sender: type, instance: Any, created: bool, **kwargs: object
) -> None:
    previous = bool(getattr(instance, "_site_rebuild_was_visible", False))
    current = _effective_visible(instance)
    if previous or current:
        _schedule_rebuild()


def _on_content_delete(sender: type, instance: Any, **kwargs: object) -> None:
    if _effective_visible(instance):
        _schedule_rebuild()


for _model in CONTENT_MODELS:
    _label = _model._meta.label_lower
    pre_save.connect(
        _capture_previous_visibility,
        sender=_model,
        dispatch_uid=f"site-rebuild-pre-save-{_label}",
    )
    post_save.connect(
        _on_content_save,
        sender=_model,
        dispatch_uid=f"site-rebuild-post-save-{_label}",
    )
    post_delete.connect(
        _on_content_delete,
        sender=_model,
        dispatch_uid=f"site-rebuild-post-delete-{_label}",
    )
