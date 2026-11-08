"""Retrieval over the portfolio database.

The old implementation loaded six JSON files and fuzzy-matched keys. This one
builds documents from the same rows the site renders, scores them with IDF-
weighted token overlap plus phrase and kind boosts, and returns structured
sources for the chat UI.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Iterable

from django.conf import settings

from content.models import (
    Achievement,
    Certification,
    Education,
    Experience,
    FAQ,
    Profile,
    Project,
    SkillCategory,
)


@dataclass(frozen=True)
class Document:
    key: str
    label: str
    url: str
    kind: str
    text: str
    answer: str | None = None


@dataclass
class RetrievalResult:
    documents: list[Document]
    sources: list[dict[str, str]]

    @property
    def has_match(self) -> bool:
        return bool(self.documents)


TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9+#.]*")

STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "of", "to", "in", "on", "at", "for", "with", "by", "from", "about",
    "and", "or", "but", "if", "then", "than", "so", "as", "into", "over",
    "i", "me", "my", "we", "our", "you", "your", "he", "him", "his",
    "she", "her", "it", "its", "they", "them", "their", "this", "that",
    "these", "those", "do", "does", "did", "have", "has", "had", "can",
    "could", "would", "should", "will", "shall", "may", "might", "must",
    "what", "which", "who", "whom", "whose", "when", "where", "why", "how",
    "tell", "give", "show", "please", "any", "some", "there", "here",
    "am", "just", "also", "very", "much", "more", "most", "currently",
}

SYNONYMS: dict[str, set[str]] = {
    "project": {"projects", "built", "build", "building", "portfolio", "work"},
    "projects": {"project", "built", "build", "portfolio", "work"},
    "built": {"project", "projects", "build"},
    "skill": {"skills", "technology", "technologies", "tools", "stack", "know"},
    "skills": {"skill", "technology", "technologies", "tools", "stack"},
    "tech": {"technology", "technologies", "tools", "stack", "skills"},
    "tools": {"tool", "technology", "technologies", "skills"},
    "tool": {"technology", "technologies", "skills"},
    "work": {"experience", "project", "projects", "job", "built"},
    "experience": {"work", "project", "projects", "job"},
    "certified": {"certification", "certifications", "certificate", "certs", "training"},
    "certification": {"certifications", "certificate", "certs", "training"},
    "certifications": {"certification", "certificate", "certs", "training"},
    "certs": {"certification", "certifications", "certificate"},
    "cert": {"certification", "certifications", "certificate", "training"},
    "certificate": {"certification", "certifications", "certs"},
    "training": {"certification", "certifications", "course", "learning"},
    "study": {"education", "degree", "college", "university", "studied", "bca"},
    "studied": {"education", "degree", "college", "university", "study", "bca"},
    "education": {"study", "studied", "degree", "college", "university", "bca"},
    "degree": {"education", "study", "college", "university", "bca"},
    "college": {"education", "university", "degree", "bca"},
    "contact": {"email", "reach", "linkedin", "github", "message", "hire"},
    "email": {"contact", "reach", "mail"},
    "reach": {"contact", "email", "message"},
    "available": {"availability", "internship", "internships", "hiring", "open", "opportunities"},
    "availability": {"available", "internship", "hiring", "open"},
    "internship": {"availability", "available", "opportunities", "role"},
    "job": {"availability", "role", "hiring", "opportunities"},
    "cyber": {"cybersecurity", "security"},
    "security": {"cybersecurity", "cyber"},
    "lab": {"labs", "tryhackme", "hackthebox", "ctf", "practice"},
    "labs": {"lab", "tryhackme", "hackthebox", "ctf", "practice"},
    "ai": {"artificial", "intelligence", "machine", "ml"},
}


def _site_url(path: str = "") -> str:
    base = settings.SITE_URL.rstrip("/")
    return f"{base}/{path.lstrip('/')}" if path else base


def _canonical(token: str) -> str:
    """Very light stemming so 'projects', 'project' and 'project's' meet."""
    if len(token) > 4 and token.endswith("ies"):
        return token[:-3] + "y"
    if len(token) > 4 and token.endswith("s") and not token.endswith("ss"):
        return token[:-1]
    return token


def tokenize(text: str) -> list[str]:
    lowered = text.lower().replace("&", " and ")
    return [
        _canonical(token)
        for token in TOKEN_RE.findall(lowered)
        if token not in STOPWORDS and len(token) >= 2
    ]


def expand_tokens(tokens: Iterable[str]) -> set[str]:
    expanded: set[str] = set()
    for token in tokens:
        expanded.add(token)
        expanded.update(
            _canonical(synonym) for synonym in SYNONYMS.get(token, set())
        )
    return expanded


def _normalize(text: str) -> str:
    return " ".join(tokenize(text))


def _profile_document(profile: Profile) -> Document:
    return Document(
        key="profile",
        label="About Vishnu",
        url=_site_url("#about"),
        kind="profile",
        text=(
            f"{profile.name} is a cybersecurity student and software developer "
            f"based in {profile.location}. Headline: {profile.headline}. "
            f"Target role: {profile.target_role}. "
            f"Availability: {profile.availability or 'not specified'}. "
            f"About: {profile.bio}"
        ),
        answer=(
            f"{profile.name} is a BCA graduate and cybersecurity student based in "
            f"{profile.location}, working toward a {profile.target_role} role. "
            f"{profile.availability}"
        ).strip(),
    )


def _contact_document(profile: Profile) -> Document:
    links = [profile.email]
    if profile.github_url:
        links.append(f"GitHub: {profile.github_url}")
    if profile.linkedin_url:
        links.append(f"LinkedIn: {profile.linkedin_url}")
    if profile.website_url:
        links.append(f"Website: {profile.website_url}")
    return Document(
        key="contact",
        label="Contact Vishnu",
        url=_site_url("#contact"),
        kind="contact",
        text=(
            f"Contact {profile.name}. Email: {profile.email}. "
            + ". ".join(links)
            + f". A contact form is available at {_site_url('#contact')}."
        ),
    )


def _project_documents() -> list[Document]:
    documents = []
    for project in Project.objects.filter(visible=True).order_by("order", "pk"):
        highlights = ", ".join(project.highlight_list)
        links = []
        if project.repo_url:
            links.append(f"Repository: {project.repo_url}")
        if project.demo_url:
            links.append(f"Demo: {project.demo_url}")

        text = (
            f"Vishnu's project: {project.title}. "
            f"Status: {project.get_status_display()}."
        )
        if project.status == Project.Status.ONGOING and project.progress is not None:
            text += f" Roughly {project.progress}% complete."
        text += f" Summary: {project.summary}"
        if project.description:
            text += f" Details: {project.description}"
        if project.tech_list:
            text += f" Technologies: {', '.join(project.tech_list)}."
        if highlights:
            text += f" Highlights: {highlights}."
        if links:
            text += " " + " ".join(links)

        documents.append(
            Document(
                key=f"project:{project.slug}",
                label=project.title,
                url=_site_url(f"projects/{project.slug}"),
                kind=f"project_{project.status}",
                text=text,
                answer=project.summary,
            )
        )
    return documents


def _skill_documents() -> list[Document]:
    documents = []
    for category in SkillCategory.objects.filter(visible=True).order_by("order", "pk"):
        skills = [skill.name for skill in category.skills.all() if skill.visible]
        if not skills:
            continue
        documents.append(
            Document(
                key=f"skills:{category.pk}",
                label=f"Skills — {category.name}",
                url=_site_url("#skills"),
                kind="skills",
                text=(
                    f"Vishnu's skills in {category.name}: {', '.join(skills)}. "
                    f"{category.description}"
                ),
                answer=(
                    f"In {category.name}, Vishnu works with {', '.join(skills)}."
                ),
            )
        )
    return documents


def build_corpus() -> list[Document]:
    profile = Profile.load()
    documents = [_profile_document(profile), _contact_document(profile)]

    if profile.resume:
        documents.append(
            Document(
                key="resume",
                label="Resume",
                url=_site_url("#resume"),
                kind="resume",
                text=(
                    "Vishnu's CV/resume is available as a PDF download from the "
                    "portfolio."
                ),
            )
        )

    documents.extend(_skill_documents())
    documents.extend(_project_documents())

    for education in Education.objects.filter(visible=True).order_by("order", "pk"):
        documents.append(
            Document(
                key=f"education:{education.pk}",
                label="Education",
                url=_site_url("#education"),
                kind="education",
                text=(
                    f"Education: {education.degree} at {education.institution}. "
                    f"{('University: ' + education.university + '. ') if education.university else ''}"
                    f"Period: {education.period or 'not specified'}. "
                    f"{education.description}"
                ),
            )
        )

    for experience in Experience.objects.filter(visible=True).order_by("order", "pk"):
        documents.append(
            Document(
                key=f"experience:{experience.pk}",
                label="Experience",
                url=_site_url("#journey"),
                kind="experience",
                text=(
                    f"Experience: {experience.role} at {experience.organization} "
                    f"({experience.get_kind_display()}, {experience.period}). "
                    f"{experience.summary} {' '.join(experience.highlight_list)}"
                ),
            )
        )

    certifications = list(
        Certification.objects.filter(visible=True).order_by("order", "pk")
    )
    for certification in certifications:
        if certification.status == Certification.Status.IN_PROGRESS:
            status_text = (
                "training in progress — not a completed certification"
            )
        elif certification.status == Certification.Status.PLANNED:
            status_text = "planned — not started or completed"
        else:
            status_text = "completed"
        issuer = f"Issuer: {certification.issuer}. " if certification.issuer else ""
        documents.append(
            Document(
                key=f"certification:{certification.pk}",
                label=certification.name,
                url=_site_url("#certifications"),
                kind="certification",
                text=(
                    f"Certification/training: {certification.name}. {issuer}"
                    f"Status: {status_text}. "
                    f"Category: {certification.get_category_display()}."
                ),
                answer=(
                    f"{certification.name} is {status_text}."
                    if certification.status != Certification.Status.COMPLETED
                    else f"{certification.name} is completed."
                ),
            )
        )

    if certifications:
        names = ", ".join(c.name for c in certifications)
        documents.append(
            Document(
                key="certifications:summary",
                label="Certifications & training",
                url=_site_url("#certifications"),
                kind="certification",
                text=(
                    f"Vishnu's certifications and training: {names}. "
                    "Unless an item is marked completed, it is in progress or "
                    "planned and must not be described as awarded."
                ),
                answer=(
                    f"Vishnu is working through {len(certifications)} "
                    "certifications and training courses, including "
                    f"{', '.join(c.name for c in certifications[:4])} and "
                    "others. All are in progress unless marked completed."
                ),
            )
        )

    for achievement in Achievement.objects.filter(visible=True).order_by("order", "pk"):
        documents.append(
            Document(
                key=f"achievement:{achievement.pk}",
                label=achievement.title,
                url=_site_url("#achievements"),
                kind="achievement",
                text=(
                    f"Lab/achievement: {achievement.title}. "
                    f"{('Organisation: ' + achievement.organization + '. ') if achievement.organization else ''}"
                    f"{achievement.description}"
                ),
            )
        )

    for faq in FAQ.objects.filter(visible=True).order_by("order", "pk"):
        documents.append(
            Document(
                key=f"faq:{faq.pk}",
                label=faq.question,
                url=_site_url("#faq"),
                kind="faq",
                text=f"FAQ. Question: {faq.question} Answer: {faq.answer}",
                answer=faq.answer,
            )
        )

    return documents


PROJECT_STATUS_TERMS = {
    "completed": {"completed", "complete", "shipped", "finished", "done"},
    "ongoing": {"ongoing", "current", "active", "developing", "working"},
    "upcoming": {"upcoming", "planned", "future", "next", "roadmap"},
}

KIND_BOOST_TERMS = {
    "profile": {"who", "about", "background", "introduction", "bio"},
    "contact": {"contact", "email", "reach", "linkedin", "github", "hire", "message"},
    "skills": {"skill", "skills", "technology", "technologies", "tools", "stack"},
    "education": {"education", "study", "studied", "degree", "college", "university", "bca"},
    "certification": {"certification", "certifications", "certs", "certified", "training", "course"},
    "achievement": {"lab", "labs", "tryhackme", "hackthebox", "ctf", "achievement"},
}


def _kind_boost(kind: str, query_lower: str, query_tokens: set[str]) -> float:
    query_words = set(re.findall(r"[a-z]+", query_lower))
    available = query_tokens | query_words
    for prefix, terms in KIND_BOOST_TERMS.items():
        if kind.startswith(prefix) and available & terms:
            return 2.5
    if kind.startswith("project") and available & {
        "project",
        "projects",
        "built",
        "portfolio",
    }:
        return 3.5
    return 0.0


def _fuzzy_hit(token: str, candidates: set[str]) -> bool:
    if len(token) < 5:
        return False
    return any(
        SequenceMatcher(None, token, candidate).ratio() >= 0.88
        for candidate in candidates
        if len(candidate) >= 4
    )


def retrieve_context(message: str, limit: int | None = None) -> RetrievalResult:
    limit = limit or settings.CHATBOT_RETRIEVAL_LIMIT
    direct_tokens = set(tokenize(message))
    query_tokens = expand_tokens(direct_tokens)
    if not query_tokens:
        return RetrievalResult(documents=[], sources=[])

    corpus = build_corpus()
    if not corpus:
        return RetrievalResult(documents=[], sources=[])

    document_frequency: Counter[str] = Counter()
    tokenized_docs: dict[str, set[str]] = {}
    for document in corpus:
        tokens = set(tokenize(f"{document.label} {document.text}"))
        tokenized_docs[document.key] = tokens
        document_frequency.update(tokens)

    total = len(corpus)
    idf = {
        token: math.log((total + 1) / (count + 1)) + 1
        for token, count in document_frequency.items()
    }

    query_lower = message.lower()
    query_normalized = _normalize(message)
    scored: list[tuple[float, Document]] = []

    for document in corpus:
        tokens = tokenized_docs[document.key]
        matched_direct = direct_tokens & tokens
        matched_synonym = (query_tokens - direct_tokens) & tokens

        fuzzy_matches = {
            token
            for token in direct_tokens - tokens
            if _fuzzy_hit(token, tokens)
        }

        if not matched_direct and not matched_synonym and not fuzzy_matches:
            continue

        coverage = len(matched_direct | fuzzy_matches) / max(
            len(direct_tokens), 1
        )

        score = sum(idf.get(token, 1.0) for token in matched_direct)
        score += sum(0.35 * idf.get(token, 1.0) for token in matched_synonym)
        score += sum(0.5 * idf.get(token, 1.0) for token in fuzzy_matches)
        score += coverage * 5.0
        score += _kind_boost(document.kind, query_lower, query_tokens)

        for status, terms in PROJECT_STATUS_TERMS.items():
            if direct_tokens & terms and document.kind == f"project_{status}":
                score += 5.0

        label_normalized = _normalize(document.label)
        if query_normalized and (
            query_normalized in _normalize(document.text)
            or query_normalized in label_normalized
        ):
            score += 4.0

        title_overlap = direct_tokens & set(tokenize(document.label))
        score += len(title_overlap) * 3.0

        if (
            coverage >= 0.34
            or len(matched_direct) >= 2
            or len(matched_synonym) >= 2
            or (not direct_tokens and matched_synonym)
        ):
            scored.append((score, document))

    scored.sort(key=lambda item: item[0], reverse=True)
    top = [document for _, document in scored[:limit]]

    sources: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for document in top:
        key = (document.label, document.url)
        if key in seen:
            continue
        seen.add(key)
        sources.append(
            {
                "label": document.label,
                "url": document.url,
                "kind": document.kind,
            }
        )
        if len(sources) >= 4:
            break

    return RetrievalResult(documents=top, sources=sources)
