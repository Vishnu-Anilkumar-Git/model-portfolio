import json
import re
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, cast


KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "knowledge"


# ============================================================
# JSON LOADING
# ============================================================

def load_json(filename: str) -> dict[str, Any]:
    """
    Safely load a JSON knowledge file.

    Missing or invalid files return an empty dictionary instead
    of crashing the chatbot.
    """
    path = KNOWLEDGE_DIR / filename

    if not path.exists():
        return {}

    try:
        with open(path, "r", encoding="utf-8") as file:
            data = json.load(file)

        if isinstance(data, dict):
            return cast(dict[str, Any], data)

    except (json.JSONDecodeError, OSError):
        pass

    return {}


# ============================================================
# TEXT NORMALIZATION
# ============================================================

def normalize_text(text: str) -> str:
    """
    Normalize user input for reliable matching.
    """
    text = text.lower().strip()

    # Remove punctuation while preserving spaces.
    text = re.sub(r"[^a-z0-9+#@.\s]", " ", text)

    # Collapse repeated whitespace.
    text = re.sub(r"\s+", " ", text)

    return text


def tokenize(text: str) -> set[str]:
    """
    Convert text into meaningful tokens.
    """
    return {
        token
        for token in normalize_text(text).split()
        if len(token) >= 2
    }


def contains_any(text: str, keywords: list[str]) -> bool:
    """
    Check whether any keyword/phrase appears in normalized text.
    """
    normalized = normalize_text(text)

    return any(
        keyword.lower() in normalized
        for keyword in keywords
    )


# ============================================================
# FUZZY MATCHING
# ============================================================

def fuzzy_match(query: str, target: str, threshold: float = 0.78) -> bool:
    """
    Detect small spelling mistakes.

    Example:
        "cybersecuirty" -> "cybersecurity"
        "carepluss" -> "careplus"
    """
    query_normalized = normalize_text(query)
    target_normalized = normalize_text(target)

    if not query_normalized or not target_normalized:
        return False

    if query_normalized in target_normalized:
        return True

    ratio = SequenceMatcher(
        None,
        query_normalized,
        target_normalized,
    ).ratio()

    return ratio >= threshold


# ============================================================
# SOURCE LOADING
# ============================================================

def load_source(filename: str) -> dict[str, Any]:
    """
    Wrapper around load_json for cleaner retrieval code.
    """
    return load_json(filename)


# ============================================================
# INTENT KEYWORDS
# ============================================================

INTENT_KEYWORDS: dict[str, list[str]] = {

    # --------------------------------------------------------
    # Identity / Profile
    # --------------------------------------------------------

    "identity": [
        "who is vishnu",
        "who's vishnu",
        "tell me about vishnu",
        "about vishnu",
        "introduce vishnu",
        "introduction",
        "background",
        "profile",
        "bio",
        "biography",
        "vishnu anilkumar",
    ],

    "profile": [
        "who is he",
        "tell me about him",
        "his background",
        "his profile",
        "professional background",
        "professional profile",
        "what does vishnu do",
        "what does he do",
        "what is vishnu doing",
    ],

    # --------------------------------------------------------
    # Location
    # --------------------------------------------------------

    "location": [
        "where is vishnu from",
        "where does vishnu live",
        "where is he from",
        "location",
        "based in",
        "from kerala",
        "from india",
        "which place",
        "which city",
        "hometown",
    ],

    # --------------------------------------------------------
    # Education
    # --------------------------------------------------------

    "education": [
        "education",
        "educated",
        "study",
        "studied",
        "studying",
        "college",
        "university",
        "degree",
        "bca",
        "academic",
        "academics",
        "graduated",
        "graduate",
        "qualification",
        "qualifications",
        "where did vishnu study",
        "where did he study",
        "what did vishnu study",
        "what did he study",
    ],

    # --------------------------------------------------------
    # Skills
    # --------------------------------------------------------

    "skills": [
        "skill",
        "skills",
        "technical skills",
        "programming",
        "programming languages",
        "languages",
        "framework",
        "frameworks",
        "technology",
        "technologies",
        "tech stack",
        "tools",
        "software",
        "what can vishnu do",
        "what does vishnu know",
        "what technologies does he know",
    ],

    # --------------------------------------------------------
    # Cybersecurity
    # --------------------------------------------------------

    "cybersecurity": [
        "cybersecurity",
        "cyber security",
        "cyber security background",
        "ethical hacking",
        "ethical hacker",
        "hacking",
        "penetration testing",
        "pentesting",
        "soc",
        "soc analyst",
        "security analyst",
        "information security",
        "network security",
        "application security",
        "security operations",
        "cyber",
        "cybersecurity career",
        "security career",
        "cybersecurity interest",
        "cybersecurity interests",
    ],

    # --------------------------------------------------------
    # Training / Certifications
    # --------------------------------------------------------

    "training": [
        "training",
        "trainings",
        "course",
        "courses",
        "learning",
        "learn",
        "currently learning",
        "currently studying",
        "certification",
        "certifications",
        "certificate",
        "certified",
        "professional diploma",
        "ceh",
        "security+",
        "cysa",
        "ccna",
        "ccnp",
        "rhce",
        "rhsca",
        "az-800",
        "az-801",
        "comptia",
    ],

    # --------------------------------------------------------
    # Experience
    # --------------------------------------------------------

    "experience": [
        "experience",
        "work experience",
        "professional experience",
        "employment",
        "worked",
        "work history",
        "job",
        "jobs",
        "career experience",
        "previous work",
    ],

    # --------------------------------------------------------
    # Career
    # --------------------------------------------------------

    "career": [
        "career",
        "career goal",
        "career goals",
        "career plan",
        "future career",
        "aspiration",
        "aspirations",
        "goal",
        "goals",
        "looking for",
        "career path",
        "professional goal",
    ],

    # --------------------------------------------------------
    # Interests / Hobbies
    # --------------------------------------------------------

    "interests": [
        "hobby",
        "hobbies",
        "interest",
        "interests",
        "passion",
        "passions",
        "free time",
        "outside work",
        "outside coding",
        "what does vishnu like",
        "what does he like",
        "what does vishnu enjoy",
        "what does he enjoy",
    ],

    # --------------------------------------------------------
    # Contact
    # --------------------------------------------------------

    "contact": [
        "contact",
        "contact vishnu",
        "reach vishnu",
        "reach him",
        "email",
        "email address",
        "phone",
        "github",
        "linkedin",
        "social media",
        "socials",
        "portfolio link",
        "profile link",
    ],

    # --------------------------------------------------------
    # FAQ
    # --------------------------------------------------------

    "faq": [
        "faq",
        "frequently asked",
        "frequently asked questions",
        "common questions",
    ],
}


# ============================================================
# PROJECT KEYWORDS
# ============================================================

PROJECT_CATEGORY_KEYWORDS = {

    "completed": [
        "completed project",
        "completed projects",
        "finished project",
        "finished projects",
        "built projects",
        "built",
        "has built",
        "has completed",
        "did vishnu build",
        "what did vishnu build",
        "what has vishnu built",
        "projects he completed",
        "projects he finished",
        "projects completed",
    ],

    "ongoing": [
        "ongoing project",
        "ongoing projects",
        "current project",
        "current projects",
        "currently working",
        "currently building",
        "working on",
        "building now",
        "in progress",
        "under development",
        "active project",
        "active projects",
        "what is vishnu working on",
        "what is he working on",
    ],

    "upcoming": [
        "upcoming project",
        "upcoming projects",
        "future project",
        "future projects",
        "planned project",
        "planned projects",
        "planning to build",
        "plans to build",
        "will build",
        "next project",
        "next projects",
        "what will vishnu build",
        "what does vishnu plan",
    ],

    "all": [
        "all projects",
        "every project",
        "project list",
        "projects list",
        "projects vishnu has",
        "projects vishnu worked on",
        "project portfolio",
        "complete project overview",
        "project overview",
        "show me his projects",
        "show me vishnu projects",
    ],
}


# ============================================================
# PROJECT HELPERS
# ============================================================

def get_projects() -> dict[str, Any]:
    """
    Load the central projects.json file.
    """
    return load_source("projects.json")


def get_project_lists(
    projects_data: dict[str, Any],
) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
]:
    """
    Safely extract project categories.
    """

    completed = projects_data.get("completed", [])
    ongoing = projects_data.get("ongoing", [])
    upcoming = projects_data.get("upcoming", [])

    if not isinstance(completed, list):
        completed = []

    if not isinstance(ongoing, list):
        ongoing = []

    if not isinstance(upcoming, list):
        upcoming = []

    return completed, ongoing, upcoming


def find_specific_projects(
    message: str,
    projects: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Find projects explicitly mentioned by the visitor.

    Supports:
    - exact project names
    - normalized names
    - small spelling errors
    """

    normalized_message = normalize_text(message)

    matches: list[dict[str, Any]] = []

    for project in projects:
        name = project.get("name")

        if not isinstance(name, str) or not name.strip():
            continue

        normalized_name = normalize_text(name)

        # Exact phrase match.
        if normalized_name in normalized_message:
            matches.append(project)
            continue

        # Fuzzy matching for project names.
        if fuzzy_match(normalized_name, normalized_message, 0.84):
            matches.append(project)

    return matches


# ============================================================
# PROJECT INTENT DETECTION
# ============================================================

def detect_project_category(message: str) -> str | None:
    """
    Determine which project category the visitor is asking about.
    """

    normalized = normalize_text(message)

    # More specific categories first.
    for category in ("completed", "ongoing", "upcoming", "all"):

        keywords = PROJECT_CATEGORY_KEYWORDS[category]

        if any(
            keyword in normalized
            for keyword in keywords
        ):
            return category

    # Additional natural-language patterns.

    if (
        re.search(r"\bwhat\b.*\bprojects?\b.*\bcompleted\b", normalized)
        or
        re.search(r"\bprojects?\b.*\bcompleted\b", normalized)
        or
        re.search(r"\bwhat\b.*\bhas\b.*\bbuilt\b", normalized)
    ):
        return "completed"

    if (
        re.search(r"\bwhat\b.*\bprojects?\b.*\bworking\b", normalized)
        or
        re.search(r"\bprojects?\b.*\bcurrently\b", normalized)
    ):
        return "ongoing"

    if (
        re.search(r"\bwhat\b.*\bprojects?\b.*\bplanned\b", normalized)
        or
        re.search(r"\bprojects?\b.*\bfuture\b", normalized)
    ):
        return "upcoming"

    return None


# ============================================================
# TOPIC DETECTION
# ============================================================

def detect_topics(message: str) -> list[str]:
    """
    Detect all relevant knowledge topics in a query.

    Multiple topics can be returned.

    Example:
        "Where did Vishnu study cybersecurity?"

    may return:
        ["education", "cybersecurity", "training"]
    """

    normalized = normalize_text(message)

    detected: list[str] = []

    for topic, keywords in INTENT_KEYWORDS.items():

        for keyword in keywords:

            if keyword.lower() in normalized:
                detected.append(topic)
                break

    return detected


# ============================================================
# SPECIAL QUERY DETECTION
# ============================================================

def is_assistant_question(message: str) -> bool:
    """
    Detect questions about the chatbot itself.

    These are handled primarily by the system prompt.
    We intentionally don't inject portfolio information into
    these questions.
    """

    normalized = normalize_text(message)

    assistant_keywords = [
        "who are you",
        "what are you",
        "what is this chatbot",
        "what is this assistant",
        "what technology powers you",
        "what technology are you using",
        "what model are you",
        "which model are you",
        "how were you built",
        "how do you work",
        "what powers you",
    ]

    return any(
        keyword in normalized
        for keyword in assistant_keywords
    )


def is_greeting(message: str) -> bool:
    """
    Detect simple greetings.
    """

    normalized = normalize_text(message)

    greetings = {
        "hi",
        "hello",
        "hey",
        "hai",
        "hii",
        "hiii",
        "good morning",
        "good afternoon",
        "good evening",
    }

    return normalized in greetings


# ============================================================
# SOURCE PRIORITY
# ============================================================

SOURCE_PRIORITY = [
    "specific_project",
    "completed_projects",
    "ongoing_projects",
    "upcoming_projects",
    "identity",
    "profile",
    "education",
    "cybersecurity",
    "training",
    "skills",
    "experience",
    "career",
    "interests",
    "contact",
    "faq",
]


def sort_sources(sources: list[str]) -> list[str]:
    """
    Return sources in deterministic priority order.
    """

    unique_sources = list(dict.fromkeys(sources))

    return sorted(
        unique_sources,
        key=lambda source: (
            SOURCE_PRIORITY.index(source)
            if source in SOURCE_PRIORITY
            else 999
        ),
    )


# ============================================================
# MAIN RETRIEVAL FUNCTION
# ============================================================

def retrieve_context(message: str) -> dict[str, Any]:
    """
    Retrieve verified portfolio information relevant to the
    visitor's question.

    IMPORTANT:
    This function never generates information.
    It only retrieves existing verified knowledge.
    """

    normalized_message = normalize_text(message)

    context: dict[str, Any] = {}
    sources: list[str] = []

    # --------------------------------------------------------
    # Empty query
    # --------------------------------------------------------

    if not normalized_message:
        return {
            "context": {},
            "sources": ["unknown"],
        }

    # --------------------------------------------------------
    # Greetings
    # --------------------------------------------------------

    if is_greeting(normalized_message):
        return {
            "context": {},
            "sources": ["greeting"],
        }

    # --------------------------------------------------------
    # Assistant questions
    # --------------------------------------------------------

    if is_assistant_question(normalized_message):
        return {
            "context": {},
            "sources": ["assistant"],
        }

    # --------------------------------------------------------
    # Load projects once.
    # --------------------------------------------------------

    projects_data = get_projects()

    completed_projects, ongoing_projects, upcoming_projects = (
        get_project_lists(projects_data)
    )

    all_projects = (
        completed_projects
        + ongoing_projects
        + upcoming_projects
    )

    # --------------------------------------------------------
    # Specific project detection
    # --------------------------------------------------------

    specific_projects = find_specific_projects(
        normalized_message,
        all_projects,
    )

    if specific_projects:
        sources.append("specific_project")
        context["specific_project"] = specific_projects

    # --------------------------------------------------------
    # Project category detection
    # --------------------------------------------------------

    project_category = detect_project_category(
        normalized_message
    )

    if project_category == "completed":
        sources.append("completed_projects")
        context["completed_projects"] = completed_projects

    elif project_category == "ongoing":
        sources.append("ongoing_projects")
        context["ongoing_projects"] = ongoing_projects

    elif project_category == "upcoming":
        sources.append("upcoming_projects")
        context["upcoming_projects"] = upcoming_projects

    elif project_category == "all":
        sources.append("projects")

        context["projects"] = {
            "completed": completed_projects,
            "ongoing": ongoing_projects,
            "upcoming": upcoming_projects,
        }

    # --------------------------------------------------------
    # Topic detection
    # --------------------------------------------------------

    topics = detect_topics(normalized_message)

    # --------------------------------------------------------
    # Identity
    # --------------------------------------------------------

    if (
        "identity" in topics
        or "profile" in topics
        or (
            "vishnu" in normalized_message
            and not project_category
            and not topics
        )
    ):
        personal_data = load_source("personal.json")

        if personal_data:
            sources.append("identity")
            context["identity"] = personal_data

    # --------------------------------------------------------
    # Profile
    # --------------------------------------------------------

    if "profile" in topics:

        profile_data = load_source("profile.json")

        if profile_data:
            sources.append("profile")
            context["profile"] = profile_data

    # --------------------------------------------------------
    # Location
    #
    # Location is usually stored in personal.json.
    # Retrieve it when location-related questions appear.
    # --------------------------------------------------------

    if "location" in topics:

        personal_data = load_source("personal.json")

        if personal_data:
            sources.append("identity")

            # Don't duplicate the entire object if identity
            # has already been loaded.
            context.setdefault(
                "identity",
                personal_data,
            )

    # --------------------------------------------------------
    # Education
    # --------------------------------------------------------

    if "education" in topics:

        education_data = load_source("education.json")

        if education_data:
            sources.append("education")
            context["education"] = education_data

    # --------------------------------------------------------
    # Skills
    # --------------------------------------------------------

    if "skills" in topics:

        skills_data = load_source("skills.json")

        if skills_data:
            sources.append("skills")
            context["skills"] = skills_data

    # --------------------------------------------------------
    # Cybersecurity
    #
    # Cybersecurity information may be spread across multiple
    # verified files.
    # --------------------------------------------------------

    if "cybersecurity" in topics:

        cybersecurity_data = load_source(
            "cybersecurity.json"
        )

        if cybersecurity_data:
            sources.append("cybersecurity")
            context["cybersecurity"] = cybersecurity_data

        # Cybersecurity questions can also be answered from
        # training information if that is where the portfolio
        # stores the relevant information.
        training_data = load_source("training.json")

        if training_data:
            sources.append("training")
            context["training"] = training_data

    # --------------------------------------------------------
    # Training / Certifications
    # --------------------------------------------------------

    if "training" in topics:

        training_data = load_source("training.json")

        if training_data:
            sources.append("training")
            context["training"] = training_data

    # --------------------------------------------------------
    # Experience
    # --------------------------------------------------------

    if "experience" in topics:

        experience_data = load_source(
            "experience.json"
        )

        if experience_data:
            sources.append("experience")
            context["experience"] = experience_data

    # --------------------------------------------------------
    # Career
    # --------------------------------------------------------

    if "career" in topics:

        career_data = load_source(
            "career.json"
        )

        if career_data:
            sources.append("career")
            context["career"] = career_data

    # --------------------------------------------------------
    # Interests / Hobbies
    # --------------------------------------------------------

    if "interests" in topics:

        interests_data = load_source(
            "interests.json"
        )

        if interests_data:
            sources.append("interests")
            context["interests"] = interests_data

    # --------------------------------------------------------
    # Contact
    # --------------------------------------------------------

    if "contact" in topics:

        personal_data = load_source("personal.json")

        if personal_data:
            sources.append("contact")

            context.setdefault(
                "contact",
                personal_data,
            )

    # --------------------------------------------------------
    # FAQ
    # --------------------------------------------------------

    if "faq" in topics:

        faq_data = load_source("faq.json")

        if faq_data:
            sources.append("faq")
            context["faq"] = faq_data

    # --------------------------------------------------------
    # Generic project question
    #
    # If someone simply asks:
    # "Tell me about Vishnu's projects"
    #
    # provide project categories.
    # --------------------------------------------------------

    if (
        re.search(r"\bprojects?\b", normalized_message)
        and not project_category
        and not specific_projects
    ):

        sources.append("projects")

        context["projects"] = {
            "completed": completed_projects,
            "ongoing": ongoing_projects,
            "upcoming": upcoming_projects,
        }

    # --------------------------------------------------------
    # Broad "tell me about Vishnu" query
    #
    # Give the model a useful but controlled profile.
    # Do NOT dump everything.
    # --------------------------------------------------------

    broad_about_patterns = [
        "tell me about vishnu",
        "about vishnu",
        "introduce vishnu",
        "give me an overview of vishnu",
        "give me a brief overview",
        "who is vishnu",
    ]

    if any(
        pattern in normalized_message
        for pattern in broad_about_patterns
    ):

        personal_data = load_source("personal.json")

        if personal_data:
            sources.append("identity")
            context.setdefault(
                "identity",
                personal_data,
            )

        education_data = load_source("education.json")

        if education_data:
            sources.append("education")
            context.setdefault(
                "education",
                education_data,
            )

        skills_data = load_source("skills.json")

        if skills_data:
            sources.append("skills")
            context.setdefault(
                "skills",
                skills_data,
            )

    # --------------------------------------------------------
    # Unknown
    # --------------------------------------------------------

    if not sources:
        sources.append("unknown")

    # --------------------------------------------------------
    # Clean source list
    # --------------------------------------------------------

    sources = sort_sources(sources)

    return {
        "context": context,
        "sources": sources,
    }