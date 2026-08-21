import json
import os
import re
from pathlib import Path

KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "knowledge"

def load_json(filename):
    path = KNOWLEDGE_DIR / filename
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def retrieve_context(message: str):
    msg = message.lower()
    
    # Supported intents/topics mapping to their respective data and source
    # identity, education, skills, training, projects, completed_projects, 
    # ongoing_projects, upcoming_projects, specific_project, contact, faq, unknown

    sources = []
    context = {}

    # Basic deterministic intent classification
    if re.search(r'\b(contact|email|phone|reach|github|linkedin)\b', msg):
        sources.append("contact")
        context["contact"] = load_json("personal.json")
    
    if re.search(r'\b(who is|identity|vishnu|about)\b', msg) and "contact" not in sources:
        sources.append("identity")
        context["identity"] = load_json("personal.json")
        
    if re.search(r'\b(study|education|college|degree|bca|university)\b', msg):
        sources.append("education")
        context["education"] = load_json("education.json")

    if re.search(r'\b(skill|skills|know|frameworks|languages)\b', msg):
        sources.append("skills")
        context["skills"] = load_json("skills.json")

    if re.search(r'\b(training|certifications|certified|cysa\+)\b', msg):
        sources.append("training")
        context["training"] = load_json("training.json")

    if re.search(r'\b(faq|frequently asked)\b', msg):
        sources.append("faq")
        context["faq"] = load_json("faq.json")

    # Project logic
    projects_data = load_json("projects.json")
    project_found = False

    # Specific projects check
    all_projects = projects_data.get("completed", []) + projects_data.get("ongoing", []) + projects_data.get("upcoming", [])
    specific_projects = []
    for p in all_projects:
        if p["name"].lower() in msg:
            specific_projects.append(p)
            
    if specific_projects:
        sources.append("specific_project")
        context["specific_project"] = specific_projects
        project_found = True

    if re.search(r'\b(completed|finished)\b.*?\bproject', msg) or re.search(r'\bproject.*?(completed|finished)\b', msg):
        sources.append("completed_projects")
        context["completed_projects"] = projects_data.get("completed", [])
        project_found = True
        
    if re.search(r'\b(ongoing|current)\b.*?\bproject', msg) or re.search(r'\bproject.*?(ongoing|current)\b', msg):
        sources.append("ongoing_projects")
        context["ongoing_projects"] = projects_data.get("ongoing", [])
        project_found = True
        
    if re.search(r'\b(upcoming|future)\b.*?\bproject', msg) or re.search(r'\bproject.*?(upcoming|future)\b', msg):
        sources.append("upcoming_projects")
        context["upcoming_projects"] = projects_data.get("upcoming", [])
        project_found = True

    if re.search(r'\b(project|projects)\b', msg) and not project_found:
        sources.append("projects")
        context["projects"] = projects_data

    # Unknown
    if not sources:
        sources.append("unknown")

    return {
        "context": context,
        "sources": list(set(sources))
    }
