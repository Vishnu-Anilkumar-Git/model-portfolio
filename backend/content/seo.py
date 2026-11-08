"""Structured data built from the same rows the site renders."""

from __future__ import annotations

from typing import Any

from django.conf import settings

from .models import Education, FAQ, Profile, Skill, SocialLink


def _absolute(path: str) -> str:
    if not path:
        return settings.SITE_URL
    if path.startswith(("http://", "https://")):
        return path
    return f"{settings.SITE_URL}{path if path.startswith('/') else '/' + path}"


def person_schema(
    profile: Profile,
    skills: list[Skill],
    socials: list[SocialLink],
    education: list[Education],
) -> dict[str, Any]:
    same_as = [s.url for s in socials if s.url]
    knows_about = [s.name for s in skills][:20]

    schema: dict[str, Any] = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": profile.name,
        "url": profile.canonical_url or settings.SITE_URL,
        "jobTitle": profile.headline,
        "description": profile.seo_description,
        "email": f"mailto:{profile.email}" if profile.email else "",
        "address": {"@type": "PostalAddress", "addressLocality": profile.location},
    }

    if same_as:
        schema["sameAs"] = same_as
    if knows_about:
        schema["knowsAbout"] = knows_about
    if education:
        schema["alumniOf"] = [
            {
                "@type": "CollegeOrUniversity",
                "name": entry.institution,
            }
            for entry in education
        ]
    if profile.og_image:
        schema["image"] = _absolute(profile.og_image.url)

    return {k: v for k, v in schema.items() if v}


def website_schema(profile: Profile) -> dict[str, Any]:
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": f"{profile.name} | Portfolio",
        "url": profile.canonical_url or settings.SITE_URL,
    }


def faq_schema(faqs: list[FAQ]) -> dict[str, Any] | None:
    if not faqs:
        return None
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": faq.question,
                "acceptedAnswer": {"@type": "Answer", "text": faq.answer},
            }
            for faq in faqs
        ],
    }
