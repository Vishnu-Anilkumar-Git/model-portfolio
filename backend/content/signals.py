"""Publish signals for content that can change the static site.

A row only requests a rebuild when the save changes something the public site
renders. The pre-save receiver reads the stored row once; the post-save receiver
compares it, so re-saving an unchanged form, editing a hidden row, or touching a
screenshot of a hidden project wakes nobody. Publishing or unpublishing a row
does change the output and therefore does request a build.

No content model has a many-to-many field, so there is no ``m2m_changed``
receiver to connect. If one is ever added, register it in the loop at the bottom
of this module alongside ``post_save``.

Contact messages, chat logs and user/token rows are deliberately absent: they
never change the rendered site.
"""

from __future__ import annotations

import logging
from typing import Any

from django.db.models import FileField
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
from .publish import request_site_rebuild

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

# Written on every save but never rendered, so they cannot justify a build.
_UNRENDERED_FIELDS = frozenset({"id", "created_at", "updated_at"})


def _effective_visible(instance: Any) -> bool:
    """Whether this row can appear on the public site, including its parents."""
    if isinstance(instance, Profile):
        # The singleton profile is always published.
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


def _revision(instance: Any) -> dict[str, Any]:
    """The stored values the public output can depend on."""
    revision: dict[str, Any] = {}
    for field in instance._meta.concrete_fields:
        if field.name in _UNRENDERED_FIELDS:
            continue

        value = getattr(instance, field.attname, None)
        if isinstance(field, FileField):
            # Empty files are "" on a loaded row and None on a fresh instance.
            value = getattr(value, "name", None) or ""
        elif isinstance(value, str):
            # Normalise TextChoices members (Status.ONGOING) to the stored value
            # so a re-saved row compares equal to the row in the database.
            value = str(value)
        revision[field.name] = value
    return revision


def _capture_previous_state(
    sender: type, instance: Any, **kwargs: object
) -> None:
    """Read the stored row before it is overwritten (one query per save)."""
    previous = None
    if instance.pk:
        previous = type(instance).objects.filter(pk=instance.pk).first()

    instance._site_rebuild_previous_row = previous
    instance._site_rebuild_was_visible = (
        _effective_visible(previous) if previous is not None else False
    )


def _on_content_save(
    sender: type, instance: Any, created: bool, **kwargs: object
) -> None:
    previous = getattr(instance, "_site_rebuild_previous_row", None)
    was_visible = bool(getattr(instance, "_site_rebuild_was_visible", False))
    is_visible = _effective_visible(instance)

    if not was_visible and not is_visible:
        return

    if (
        previous is not None
        and was_visible == is_visible
        and _revision(previous) == _revision(instance)
    ):
        # Saved, but nothing the site renders changed.
        return

    # The publish path defers itself to transaction.on_commit.
    request_site_rebuild(f"save:{sender._meta.label_lower}")


def _on_content_delete(sender: type, instance: Any, **kwargs: object) -> None:
    if _effective_visible(instance):
        request_site_rebuild(f"delete:{sender._meta.label_lower}")


for _model in CONTENT_MODELS:
    _label = _model._meta.label_lower
    pre_save.connect(
        _capture_previous_state,
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
