"""Django settings for the Vishnu Anilkumar portfolio API.

All deployment-specific values come from environment variables (see
.env.example). The only committed fallbacks are development-safe values.
"""

from datetime import timedelta
from pathlib import Path
from typing import Any, cast

import dj_database_url
from decouple import Csv, config as _config
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent


def get_bool(name: str, default: bool = False) -> bool:
    return cast(bool, _config(name, default=default, cast=bool))


def get_list(name: str, default: str) -> list[str]:
    return cast(list[str], _config(name, default=default, cast=Csv()))


def get_int(name: str, default: int) -> int:
    return cast(int, _config(name, default=default, cast=int))


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------

DEBUG = get_bool("DEBUG", default=False)

# No usable default in production: a known key would let anyone forge sessions
# and JWTs. Development keeps an obvious throwaway value so `runserver` works
# before `.env` exists.
SECRET_KEY = _config("SECRET_KEY", default="").strip()
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "django-insecure-dev-only-do-not-use-in-production"
    else:
        raise ImproperlyConfigured(
            "SECRET_KEY must be set when DEBUG is off. Copy backend/.env.example "
            "to backend/.env and generate one with:\n"
            '  python -c "from django.core.management.utils import '
            'get_random_secret_key as k; print(k())"'
        )

ALLOWED_HOSTS = get_list("ALLOWED_HOSTS", default="127.0.0.1,localhost,testserver")

SITE_URL = _config("SITE_URL", default="http://localhost:5173").rstrip("/")
ADMIN_URL = _config("ADMIN_URL", default="http://localhost:5174").rstrip("/")

# Vercel Deploy Hook URL (Project Settings > Git > Deploy Hooks, branch main).
# Called with an HTTP POST and an empty body after public content changes.
# Empty disables the publish pipeline entirely; the URL is a secret, can be
# revoked in Vercel, and must never reach a VITE_* variable or the admin bundle.
SITE_REBUILD_HOOK_URL = _config("SITE_REBUILD_HOOK_URL", default="").strip()

# Number of reverse proxies in front of Django. Set this to 1 on Render/Railway
# so DRF's throttles key on the visitor IP from X-Forwarded-For. Leave unset
# when the app is reachable directly, otherwise clients could spoof the header.
NUM_PROXIES = _config("NUM_PROXIES", default="").strip()

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "content",
    "chatbot",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "config.middleware.SecurityHeadersMiddleware",
    "config.middleware.AdminLoginThrottleMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES: list[dict[str, Any]] = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

DATABASES: dict[str, dict[str, Any]] = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
        conn_health_checks=True,
    )
}


# ---------------------------------------------------------------------------
# Passwords / i18n
# ---------------------------------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True


# ---------------------------------------------------------------------------
# Static and media
# ---------------------------------------------------------------------------

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# Manifest hashing requires `collectstatic`; using it in development makes the
# Django admin raise "Missing staticfiles manifest entry" before the first
# collectstatic run. Keep plain storage for DEBUG and hashed storage in prod.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": (
            "django.contrib.staticfiles.storage.StaticFilesStorage"
            if DEBUG
            else "whitenoise.storage.CompressedManifestStaticFilesStorage"
        ),
    },
}

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

FIXTURE_DIRS = [BASE_DIR / "fixtures"]


# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------

EMAIL_HOST = _config("EMAIL_HOST", default="")
EMAIL_PORT = get_int("EMAIL_PORT", default=587)
# Never let a slow SMTP server hold the contact request open indefinitely.
EMAIL_TIMEOUT = get_int("EMAIL_TIMEOUT", default=10)
EMAIL_HOST_USER = _config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = _config("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = get_bool("EMAIL_USE_TLS", default=True)
DEFAULT_FROM_EMAIL = _config(
    "DEFAULT_FROM_EMAIL", default="Vishnu Portfolio <no-reply@localhost>"
)
CONTACT_NOTIFICATION_EMAIL = _config(
    "CONTACT_NOTIFICATION_EMAIL", default="vishnuanil2k05@gmail.com"
)

if EMAIL_HOST:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"


# ---------------------------------------------------------------------------
# Cache (throttling + chatbot rate limits). Swap for Redis in production.
# ---------------------------------------------------------------------------

CACHES: dict[str, dict[str, Any]] = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "portfolio-cache",
    }
}


# ---------------------------------------------------------------------------
# REST framework
# ---------------------------------------------------------------------------

REST_FRAMEWORK: dict[str, Any] = {
    # Deny by default: public endpoints opt in to AllowAny explicitly.
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",
        "chat": "12/min",
        "contact": "5/hour",
        "login": "10/min",
        "publish": "6/hour",
    },
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "EXCEPTION_HANDLER": "content.exceptions.api_exception_handler",
}

if NUM_PROXIES:
    REST_FRAMEWORK["NUM_PROXIES"] = int(NUM_PROXIES)

if not DEBUG:
    REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [
        "rest_framework.renderers.JSONRenderer",
    ]

SIMPLE_JWT: dict[str, Any] = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOWED_ORIGINS = get_list(
    "CORS_ALLOWED_ORIGINS",
    default=(
        "http://127.0.0.1:5173,http://localhost:5173,"
        "http://127.0.0.1:5174,http://localhost:5174"
    ),
)
CORS_ALLOW_CREDENTIALS = False
CORS_URLS_REGEX = r"^/api/.*$"

CSRF_TRUSTED_ORIGINS = get_list("CSRF_TRUSTED_ORIGINS", default="")

# Comma-separated origins the admin panel is allowed to authenticate from is
# already covered by CORS_ALLOWED_ORIGINS; JWT does not use cookies.


# ---------------------------------------------------------------------------
# Chatbot
# ---------------------------------------------------------------------------

CHATBOT_PROVIDER = _config("CHATBOT_PROVIDER", default="auto").strip().lower()
CHATBOT_MAX_TOKENS = get_int("CHATBOT_MAX_TOKENS", default=400)
CHATBOT_TEMPERATURE = 0.2
CHATBOT_HISTORY_TURNS = 6
CHATBOT_RETRIEVAL_LIMIT = 6

OLLAMA_HOST = _config("OLLAMA_HOST", default="http://127.0.0.1:11434")
OLLAMA_MODEL = _config("OLLAMA_MODEL", default="llama3.2:3b")

LLM_API_KEY = _config(
    "GROQ_API_KEY",
    default=_config("LLM_API_KEY", default=""),
).strip()
LLM_BASE_URL = _config(
    "LLM_BASE_URL", default="https://api.groq.com/openai/v1"
).rstrip("/")
LLM_MODEL = _config("LLM_MODEL", default="llama-3.3-70b-versatile")
LLM_TIMEOUT_SECONDS = get_int("LLM_TIMEOUT_SECONDS", default=25)


# ---------------------------------------------------------------------------
# Security headers / deployment hardening
# ---------------------------------------------------------------------------

SECURE_SSL_REDIRECT = get_bool("SECURE_SSL_REDIRECT", default=not DEBUG)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
# Django admin only; the SPAs use JWTs and never send cookies to the API.
SESSION_COOKIE_AGE = 60 * 60 * 12
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

SECURE_HSTS_SECONDS = 0 if DEBUG else 31_536_000
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
X_FRAME_OPTIONS = "DENY"

# Serve uploaded files through Django. Fine for a low-traffic portfolio; point
# MEDIA_URL at object storage / nginx if traffic grows.
SERVE_MEDIA = get_bool("SERVE_MEDIA", default=True)

DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

LOGGING: dict[str, Any] = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {"handlers": ["console"], "level": "INFO" if not DEBUG else "DEBUG"},
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "chatbot": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "content.audit": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "content.rebuild": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "content.security": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
