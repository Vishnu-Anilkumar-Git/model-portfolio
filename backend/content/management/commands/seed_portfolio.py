"""Seed the database from the audited content of the old static site.

Idempotent: safe to run more than once. It never deletes rows that were added
later through the admin panel, and admin edits win on subsequent runs except
for the explicit defaults set here.
"""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from content.models import (
    Achievement,
    Certification,
    Education,
    FAQ,
    Profile,
    Project,
    Skill,
    SkillCategory,
    SocialLink,
    SuggestedQuestion,
)

PROFILE: dict[str, Any] = {
    "name": "Vishnu Anilkumar",
    "headline": "Cybersecurity Student · Aspiring SOC Analyst · Ethical Hacking & Security Enthusiast",
    "target_role": "SOC Analyst",
    "location": "Kerala, India",
    "email": "vishnuanil2k05@gmail.com",
    "availability": "Open to SOC analyst, security intern, and entry-level cybersecurity roles.",
    "hero_eyebrow": "root@portfolio:~$ whoami",
    "about_heading": "From building software to breaking (and defending) it.",
    "bio": (
        "I'm a BCA graduate based in Kerala, India, with a strong interest in "
        "cybersecurity, ethical hacking, threat intelligence, and security "
        "operations. My background in software development helps me understand "
        "both how applications are built — and how they can be attacked and "
        "secured.\n\n"
        "I completed my Bachelor of Computer Applications at BVM Holy Cross "
        "College, Cherpunkal, affiliated with Mahatma Gandhi University. I'm "
        "currently developing my skills across networking, Linux, penetration "
        "testing, threat intelligence, security monitoring, and AI-assisted "
        "security systems. I enjoy building practical projects rather than "
        "limiting myself to theory, with a long-term goal of working as a "
        "cybersecurity analyst and progressing into advanced security engineering."
    ),
    "github_url": "https://github.com/Vishnu-Anilkumar-Git",
    "linkedin_url": "https://www.linkedin.com/in/vishnu-anilkumar-1083b038b",
    "website_url": "https://vishnuanilkumar.in",
    "seo_title": "Vishnu Anilkumar | Cybersecurity Student & Aspiring SOC Analyst",
    "seo_description": (
        "Vishnu Anilkumar is a BCA graduate and cybersecurity student from "
        "Kerala aspiring to become a SOC Analyst, with interests in ethical "
        "hacking, threat intelligence, security operations, AI security, and "
        "software development."
    ),
    "canonical_url": "https://vishnuanilkumar.in/",
    "chatbot_greeting": "Ask me about Vishnu's projects, skills, certifications or background.",
    "footer_note": "Designed and built by Vishnu Anilkumar.",
}

SOCIALS = [
    {"label": "Email", "url": "mailto:vishnuanil2k05@gmail.com", "icon": "mail"},
    {"label": "GitHub", "url": "https://github.com/Vishnu-Anilkumar-Git", "icon": "github"},
    {
        "label": "LinkedIn",
        "url": "https://www.linkedin.com/in/vishnu-anilkumar-1083b038b",
        "icon": "linkedin",
    },
    {"label": "vishnuanilkumar.in", "url": "https://vishnuanilkumar.in", "icon": "globe"},
]

SKILLS: list[tuple[str, str, list[str]]] = [
    (
        "Programming & Development",
        "Languages and frameworks used to build the projects on this site.",
        [
            "Python",
            "JavaScript",
            "Java",
            "C / C++",
            "PHP",
            "HTML / CSS",
            "Django",
            "Flask",
            "React",
            "Tailwind CSS",
            "Bootstrap",
        ],
    ),
    (
        "Cybersecurity",
        "The security areas I am actively training and building in.",
        [
            "Ethical Hacking",
            "Network Security",
            "Vulnerability Assessment",
            "Threat Intelligence",
            "SOC / Security Operations",
            "Linux & Kali Linux",
            "Network Scanning",
            "Web App Security",
            "Mobile App Security",
            "OSINT",
            "Incident Detection & Analysis",
        ],
    ),
    (
        "Tools & Technologies",
        "Day-to-day tooling for development and security work.",
        [
            "Nmap",
            "Wireshark",
            "Burp Suite",
            "Metasploit",
            "MobSF",
            "Termux",
            "Git / GitHub",
            "Docker",
            "XAMPP",
            "MySQL / MariaDB",
            "PostgreSQL",
            "VS Code",
        ],
    ),
    (
        "AI, Data & Security Projects",
        "Applied AI and data tooling used in security-focused builds.",
        [
            "Python AI/ML",
            "Scikit-learn",
            "Pandas",
            "OpenAI APIs",
            "Whisper / Faster-Whisper",
            "Ollama",
            "Computer Vision",
            "AI-Assisted Threat Detection",
        ],
    ),
]

PROJECTS: list[dict[str, Any]] = [
    {
        "title": "CarePlus — Hospital Appointment Booking System",
        "subtitle": "Full-stack appointment management for patients, doctors and admins",
        "summary": "A full-stack hospital appointment management platform to manage patients, doctors, appointments, and administrative workflows.",
        "description": (
            "CarePlus is a full-stack hospital appointment booking system built "
            "around the daily workflows of a small hospital: patients book "
            "appointments, doctors manage their schedules, and administrators "
            "oversee doctors, patients and bookings from one place.\n\n"
            "The project was built to practise complete CRUD application design — "
            "authentication, role-aware dashboards, relational data modelling and "
            "a database-backed booking flow — rather than a single-page demo."
        ),
        "status": "completed",
        "tech_stack": "PHP, MariaDB",
        "accent": "teal",
        "highlights": "Patient, doctor and admin workflows\nAppointment booking backed by a relational schema\nRole-aware dashboards",
    },
    {
        "title": "Kerala Tourism Website",
        "subtitle": "Destination and travel information platform",
        "summary": "A tourism platform showcasing Kerala's destinations, attractions, and travel information with a dynamic backend.",
        "description": (
            "A tourism platform for exploring Kerala's destinations and travel "
            "information. The site pairs a browsable front end with a dynamic "
            "Django backend, so destination content is managed as structured data "
            "instead of hand-written pages."
        ),
        "status": "completed",
        "tech_stack": "Django, Python",
        "accent": "orange",
        "highlights": "Structured destination content\nServer-rendered Django views",
    },
    {
        "title": "Precision Builders — Intelligent Construction Platform",
        "subtitle": "Project collaboration with ML-based cost and time prediction",
        "summary": "A construction collaboration platform combining project management with ML-based cost and time prediction to assist planning.",
        "description": (
            "Precision Builders combines construction project management with "
            "machine-learning estimates for cost and schedule. The platform is "
            "aimed at planning: teams keep project information in one place and "
            "use model predictions as a second opinion on cost and duration.\n\n"
            "It was an exercise in connecting a conventional Django application to "
            "a scikit-learn prediction pipeline, including preparing training data "
            "and surfacing predictions inside the UI."
        ),
        "status": "completed",
        "tech_stack": "Python, Django, Machine Learning, SQLite",
        "accent": "violet",
        "highlights": "Construction project management workflow\nML-assisted cost and time estimates",
    },
    {
        "title": "OffGrid — E-Commerce Clothing Store",
        "subtitle": "Django storefront with catalogue, reviews, coupons and payments",
        "summary": "A full-featured Django clothing store: product management, filtering, sorting, stock indicators, reviews, ratings, coupons, delivery estimates, and Razorpay payments.",
        "description": (
            "OffGrid is a complete clothing storefront built with Django. The "
            "catalogue supports filtering and sorting, stock indicators, product "
            "reviews and ratings, coupon codes, delivery estimates and Razorpay "
            "checkout.\n\n"
            "The interesting part is the depth: a real storefront needs inventory "
            "state, pricing rules, order handling and payment integration to work "
            "together, and this project is where those pieces are being built out."
        ),
        "status": "ongoing",
        "progress": 75,
        "tech_stack": "Python, Django, PostgreSQL/MySQL, Razorpay",
        "accent": "orange",
        "highlights": "Catalogue filtering, sorting and stock state\nReviews, ratings and coupons\nRazorpay payment integration",
    },
    {
        "title": "ASI — AI Security Platform",
        "subtitle": "Camera, sensor and network monitoring with AI alerts",
        "summary": "An intelligent physical-security platform combining cameras, sensors, and network monitoring to detect suspicious activity and generate alerts.",
        "description": (
            "ASI is an AI security platform that brings cameras, sensors and "
            "network monitoring into one detection pipeline. Instead of treating "
            "each source separately, it correlates what the sensors see and "
            "generates alerts for activity that looks suspicious.\n\n"
            "The project sits at the intersection of computer vision, sensor input "
            "and security monitoring — the same overlap between physical and "
            "digital security that the rest of this portfolio explores."
        ),
        "status": "ongoing",
        "tech_stack": "Python, AI/ML, Computer Vision, Raspberry Pi",
        "accent": "teal",
        "highlights": "Camera and sensor fusion pipeline\nAI-assisted suspicious-activity alerts",
    },
    {
        "title": "Threat Intelligence Dashboard",
        "subtitle": "Collect, process and visualise threat intelligence",
        "summary": "A security dashboard for collecting, processing, and visualizing threat intel — helping analysts monitor IOCs, suspicious infrastructure, and emerging threats.",
        "description": (
            "A dashboard for gathering threat intelligence feeds, processing "
            "indicators and presenting them in a form an analyst can scan quickly. "
            "It focuses on the collector-to-visualisation path: normalise incoming "
            "IOCs, track suspicious infrastructure and make emerging threats "
            "visible without digging through raw feeds."
        ),
        "status": "ongoing",
        "tech_stack": "Python, Threat Intel APIs",
        "accent": "violet",
        "highlights": "IOC collection and normalisation\nAnalyst-facing threat visualisation",
    },
    {
        "title": "JARVIS — Personal AI Assistant",
        "subtitle": "Local voice assistant with speech recognition",
        "summary": "A local personal AI assistant focused on natural voice interaction, speech recognition, and future integration with security workflows.",
        "description": (
            "JARVIS is a locally running assistant built around voice interaction: "
            "speech recognition, voice activity detection and an LLM for responses. "
            "Running locally keeps audio off third-party services and makes the "
            "assistant available without an internet round trip.\n\n"
            "The long-term direction is to connect it to security workflows, so "
            "routine queries and lab tasks can be handled conversationally."
        ),
        "status": "ongoing",
        "tech_stack": "Python, Faster-Whisper, Silero VAD, LLMs",
        "accent": "orange",
        "highlights": "Local speech-to-text with Faster-Whisper\nVoice activity detection with Silero VAD\nLocal LLM responses",
    },
    {
        "title": "AI-Based Property Security & Sensor Fusion",
        "subtitle": "Telling human movement apart from environmental noise",
        "summary": "Research combining cameras, mmWave radar, and sensors with AI to identify meaningful human movement vs. normal environmental activity.",
        "description": (
            "A research build that combines cameras, mmWave radar and other sensors "
            "with AI to distinguish meaningful human movement from ordinary "
            "environmental activity. The hard problem is false positives: a curtain "
            "moving in the wind should not trigger the same response as a person "
            "crossing a room.\n\n"
            "The project explores sensor fusion as a way to make that distinction "
            "more reliable than any single sensor on its own."
        ),
        "status": "ongoing",
        "tech_stack": "AI/ML, mmWave Radar, Raspberry Pi, Sensor Fusion",
        "accent": "teal",
        "highlights": "Multi-sensor fusion\nHuman movement vs. environmental noise classification",
    },
    {
        "title": "CTI Platform",
        "subtitle": "End-to-end cyber threat intelligence platform",
        "summary": "A complete cyber threat intelligence platform for collecting, correlating, analyzing, and visualizing threats with automated IOC enrichment.",
        "description": (
            "A planned cyber threat intelligence platform covering the full "
            "lifecycle: collection from multiple feeds, correlation across "
            "indicators, analysis and visualisation, with automated IOC enrichment "
            "to add context to raw data."
        ),
        "status": "upcoming",
        "tech_stack": "Python, Threat Intelligence, Automation",
        "accent": "violet",
    },
    {
        "title": "AI SOC Analyst",
        "subtitle": "AI-assisted alert triage and investigation",
        "summary": "An AI-assisted SOC platform to analyze security events, prioritize alerts, correlate indicators, and assist analysts with investigation.",
        "description": (
            "A planned SOC platform that uses AI to help with the part of analyst "
            "work that scales badly: reading every alert, ranking what matters and "
            "correlating indicators before an investigation starts. The goal is "
            "assistance for the analyst, not replacement of judgement."
        ),
        "status": "upcoming",
        "tech_stack": "Python, LLMs, SIEM Concepts",
        "accent": "orange",
    },
    {
        "title": "Advanced Network Security Monitoring System",
        "subtitle": "Real-time traffic monitoring and anomaly detection",
        "summary": "Real-time network monitoring and threat detection capable of identifying suspicious traffic and anomalous behavior.",
        "description": (
            "A planned network monitoring system for watching traffic in real time, "
            "spotting suspicious flows and flagging behaviour that deviates from a "
            "baseline."
        ),
        "status": "upcoming",
        "tech_stack": "Python, Networking, Packet Analysis",
        "accent": "teal",
    },
    {
        "title": "Automated Vulnerability Assessment Platform",
        "subtitle": "Recon, enumeration and reporting in one pipeline",
        "summary": "A platform to automate reconnaissance, vulnerability discovery, service enumeration, and reporting across authorized systems.",
        "description": (
            "A planned platform that automates the repetitive parts of an "
            "authorized assessment: reconnaissance, service enumeration, "
            "vulnerability discovery and consistent reporting. Scope and "
            "authorization are treated as a first-class part of the workflow."
        ),
        "status": "upcoming",
        "tech_stack": "Python, Nmap, Automation, Reporting",
        "accent": "violet",
    },
    {
        "title": "AI-Powered Digital Security Lab",
        "subtitle": "A personal lab for hands-on security practice",
        "summary": "A personal cybersecurity lab: virtualized environments, Kali Linux, vulnerable machines, network monitoring, and AI-assisted experimentation.",
        "description": (
            "A planned home security lab built on virtualised environments, Kali "
            "Linux, intentionally vulnerable machines and network monitoring, with "
            "AI-assisted experimentation layered on top. It is the practice ground "
            "for the techniques used in the other projects."
        ),
        "status": "upcoming",
        "tech_stack": "Kali Linux, Virtualisation, Networking",
        "accent": "orange",
    },
]

CERTIFICATIONS = [
    ("Professional Diploma in Cyber Security", "", "in_progress", "training"),
    ("CompTIA A+", "CompTIA", "in_progress", "certification"),
    ("CompTIA Network+", "CompTIA", "in_progress", "certification"),
    ("CompTIA CySA+", "CompTIA", "in_progress", "certification"),
    ("CCNA", "Cisco", "in_progress", "certification"),
    ("CCNP", "Cisco", "in_progress", "certification"),
    ("AZ-800", "Microsoft", "in_progress", "certification"),
    ("AZ-801", "Microsoft", "in_progress", "certification"),
    ("RHCE", "Red Hat", "in_progress", "certification"),
    ("Ethical Hacking & Cybersecurity", "SMEClabs", "in_progress", "training"),
]

FAQS = [
    (
        "Who is Vishnu Anilkumar?",
        "Vishnu Anilkumar is a BCA graduate and cybersecurity student with a background in software development, now focused on ethical hacking, threat intelligence, and security operations.",
    ),
    (
        "What does Vishnu Anilkumar specialize in?",
        "His current focus areas are networking, Linux, penetration testing, threat intelligence, security monitoring, and AI-assisted security systems, with the long-term goal of working as a cybersecurity analyst (SOC Analyst).",
    ),
    (
        "What cybersecurity projects has Vishnu Anilkumar built?",
        "Ongoing security-focused projects include a Threat Intelligence Dashboard, an AI security platform (ASI) combining cameras, sensors, and AI analysis, and an AI-based property security and sensor fusion project. The projects section has the full details.",
    ),
    (
        "What technologies does Vishnu Anilkumar use?",
        "Python, Django, Flask, and JavaScript for development; Nmap, Wireshark, Burp Suite, Metasploit, and Kali Linux for security work; and Python-based AI/ML tools including scikit-learn, OpenAI APIs, and Whisper.",
    ),
    (
        "What is Vishnu Anilkumar currently learning?",
        "He's currently working through training in a Professional Diploma in Cyber Security, CompTIA Network+ and CySA+, CCNA, and RHCE, alongside hands-on practice in penetration testing and AI-assisted security systems. These are training in progress, not completed certifications.",
    ),
    (
        "How can Vishnu Anilkumar be contacted?",
        "By email at vishnuanil2k05@gmail.com, or via GitHub and LinkedIn. The contact section has a form as well.",
    ),
]

SUGGESTIONS = [
    "What projects has Vishnu built?",
    "What are his strongest skills?",
    "Is he available for internships?",
    "How can I contact him?",
]


class Command(BaseCommand):
    help = "Seed portfolio content from the audited legacy site (idempotent)."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        self._seed_profile()
        self._seed_socials()
        self._seed_skills()
        self._seed_projects()
        self._seed_certifications()
        self._seed_education()
        self._seed_achievements()
        self._seed_faqs()
        self._seed_suggestions()
        self.stdout.write(self.style.SUCCESS("Portfolio content seeded."))
        self.stdout.write(
            "Next: create an admin user with `python manage.py createsuperuser`."
        )

    def _seed_profile(self) -> None:
        profile = Profile.load()
        for field, value in PROFILE.items():
            setattr(profile, field, value)
        profile.save()

    def _seed_socials(self) -> None:
        for index, social in enumerate(SOCIALS):
            SocialLink.objects.update_or_create(
                label=social["label"],
                defaults={
                    "url": social["url"],
                    "icon": social["icon"],
                    "order": index,
                    "visible": True,
                },
            )

    def _seed_skills(self) -> None:
        for category_index, (name, description, skills) in enumerate(SKILLS):
            category, _ = SkillCategory.objects.update_or_create(
                name=name,
                defaults={
                    "description": description,
                    "order": category_index,
                    "visible": True,
                },
            )
            for skill_index, skill_name in enumerate(skills):
                Skill.objects.update_or_create(
                    category=category,
                    name=skill_name,
                    defaults={"order": skill_index, "visible": True},
                )

    def _seed_projects(self) -> None:
        for index, data in enumerate(PROJECTS):
            payload = dict(data)
            title = payload.pop("title")
            payload["slug"] = slugify(title)[:120]
            Project.objects.update_or_create(
                slug=payload["slug"],
                defaults={
                    **payload,
                    "title": title,
                    "order": index,
                    "visible": True,
                },
            )

    def _seed_certifications(self) -> None:
        for index, (name, issuer, cert_status, category) in enumerate(CERTIFICATIONS):
            Certification.objects.update_or_create(
                name=name,
                defaults={
                    "issuer": issuer,
                    "status": cert_status,
                    "category": category,
                    "order": index,
                    "visible": True,
                },
            )

    def _seed_education(self) -> None:
        Education.objects.update_or_create(
            institution="BVM Holy Cross College, Cherpunkal",
            degree="Bachelor of Computer Applications",
            defaults={
                "university": "Mahatma Gandhi University",
                "location": "Kerala, India",
                "description": (
                    "Bachelor of Computer Applications at BVM Holy Cross College, "
                    "Cherpunkal, affiliated with Mahatma Gandhi University. Built "
                    "the software-development foundation behind the projects on "
                    "this site."
                ),
                "current": False,
                "order": 0,
                "visible": True,
            },
        )

    def _seed_achievements(self) -> None:
        Achievement.objects.update_or_create(
            title="Hands-on Security Labs",
            defaults={
                "organization": "",
                "category": "lab",
                "description": (
                    "Practical work in virtualised environments with Kali Linux, "
                    "intentionally vulnerable machines and network monitoring — "
                    "the lab side of the security training."
                ),
                "order": 0,
                "visible": True,
            },
        )

    def _seed_faqs(self) -> None:
        for index, (question, answer) in enumerate(FAQS):
            FAQ.objects.update_or_create(
                question=question,
                defaults={"answer": answer, "order": index, "visible": True},
            )

    def _seed_suggestions(self) -> None:
        for index, text in enumerate(SUGGESTIONS):
            SuggestedQuestion.objects.update_or_create(
                text=text,
                defaults={"order": index, "visible": True},
            )
