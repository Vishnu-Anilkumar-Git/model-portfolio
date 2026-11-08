from django.apps import AppConfig


class ContentConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "content"
    verbose_name = "Portfolio content"

    def ready(self) -> None:
        # Registering the receivers here keeps model saves (Django admin and
        # the REST admin panel) on the same publish path.
        from . import signals  # noqa: F401
