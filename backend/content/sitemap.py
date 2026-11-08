"""Sitemap and robots.txt generated from the database.

The public site is a static SPA, so its build also fetches this data to write a
static sitemap. These views let the API origin serve the same files directly
(or behind a proxy) without a second source of truth.
"""

from __future__ import annotations

from xml.sax.saxutils import escape

from django.conf import settings

from .models import Project


def _site_root() -> str:
    return settings.SITE_URL.rstrip("/")


def build_sitemap() -> str:
    root = _site_root()
    entries = [
        f"  <url>\n    <loc>{escape(root + '/')}</loc>\n"
        "    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>"
    ]

    projects = Project.objects.filter(visible=True).order_by("-updated_at")
    for project in projects:
        lastmod = project.updated_at.strftime("%Y-%m-%dT%H:%M:%SZ")
        entries.append(
            f"  <url>\n"
            f"    <loc>{escape(f'{root}/projects/{project.slug}')}</loc>\n"
            f"    <lastmod>{lastmod}</lastmod>\n"
            "    <changefreq>monthly</changefreq>\n"
            "    <priority>0.8</priority>\n"
            "  </url>"
        )

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )


def build_robots() -> str:
    return (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /admin/\n"
        "Disallow: /control/\n"
        "\n"
        f"Sitemap: {_site_root()}/sitemap.xml\n"
    )
