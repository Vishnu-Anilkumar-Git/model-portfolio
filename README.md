# Vishnu Anilkumar — portfolio platform

A three-part portfolio: a Django API that owns every fact about Vishnu, a public React site that renders it, and a separate JWT-protected admin panel that edits it. The assistant answers only from the same database.

```
                 ┌──────────────────────────────┐
                 │        PostgreSQL / SQLite    │
                 │  profile · projects · skills  │
                 │  certs · labs · FAQs · logs   │
                 └──────────────┬───────────────┘
                                │ Django ORM
                 ┌──────────────▼───────────────┐
   public site ──►   Django 6 + DRF + SimpleJWT  ◄── admin panel
   :5173          │  /api/v1/site/ (one payload) │   :5174
                 │  /api/v1/chat/ (SSE stream)  │
                 │  /api/v1/admin/* (JWT CRUD)  │
                 └──────────────┬───────────────┘
                                │ grounded retrieval
                 ┌──────────────▼───────────────┐
                 │ Groq (prod) · Ollama (local) │
                 │ extractive fallback           │
                 └──────────────────────────────┘
```

## Repository layout

| Path | What it is |
| --- | --- |
| `backend/` | Django + DRF API, content models, chatbot pipeline, tests |
| `site/` | Public Vite + React + TypeScript + Tailwind site |
| `admin/` | Separate Vite + React admin panel (JWT login, full CRUD) |
| `legacy/` | Original static `index.html` and JSON knowledge files, kept for reference only |
| `docs/architecture.md` | Data flow, retrieval, chatbot grounding and API contracts |
| `docs/deployment.md` | Deployment runbook: hosts, environment, PostgreSQL, backups, rollback |
| `docs/audit-report.md` | Release audit: what was tested, fixed and left unverified |
| `SECURITY.md` | Threat model, controls, audit results and known limits |

The legacy files are not loaded by anything. Edit content in the admin panel, not in HTML or JSON.

## Local setup

Prerequisites: Python 3.12+, Node 20+.

### 1. API

```bash
python -m venv venv
source venv/Scripts/activate        # Windows; use venv/bin/activate on macOS/Linux
pip install -r backend/requirements.txt

cp backend/.env.example backend/.env
# set SECRET_KEY at minimum

cd backend
python manage.py migrate
python manage.py seed_portfolio      # idempotent: fills the DB from the legacy content
python manage.py createsuperuser
python manage.py runserver 8000
```

`seed_portfolio` only creates rows that do not exist yet (matched by natural keys), so it is safe to re-run. It does not overwrite edits made in the admin panel.

Check it: `curl http://127.0.0.1:8000/api/v1/health/`.

### 2. Public site

```bash
cd site
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in site/dist
```

`VITE_API_URL` defaults to `http://127.0.0.1:8000/api/v1`. Copy `site/.env.example` to `site/.env.local` to point it elsewhere.

### 3. Admin panel

```bash
cd admin
npm install
npm run dev        # http://localhost:5174
npm run build      # production bundle in admin/dist
```

Copy `admin/.env.example` to `admin/.env.local` and set `VITE_API_URL` and `VITE_SITE_URL`. Sign in with the superuser created above.

### Ports in this checkout

Port `8000` was occupied by an older server on this machine, so `site/.env.local` and `admin/.env.local` point both frontends at the API on **8001**. If you free 8000 and run the API there, delete those two files (or update them) to use the defaults.

## Environment variables

All backend values live in `backend/.env` (see `backend/.env.example`). Important ones:

| Variable | Purpose |
| --- | --- |
| `SECRET_KEY` | Django secret. Required outside `DEBUG`. |
| `DEBUG` | `False` by default; set `True` locally. |
| `ALLOWED_HOSTS` | Comma-separated hostnames. |
| `DATABASE_URL` | PostgreSQL URL; falls back to SQLite. |
| `CORS_ALLOWED_ORIGINS` | Must include both the site and admin origins. |
| `SITE_URL` / `ADMIN_URL` | Canonical public URLs used in source chips, canonical tags and emails. |
| `CHATBOT_PROVIDER` | `auto` (default), `groq`, `openai`, `ollama`, `extractive`. |
| `GROQ_API_KEY` | Groq key for production inference. |
| `LLM_BASE_URL` / `LLM_MODEL` | Any OpenAI-compatible endpoint; defaults to Groq + `llama-3.3-70b-versatile`. |
| `OLLAMA_HOST` / `OLLAMA_MODEL` | Local fallback; defaults to `127.0.0.1:11434` + `llama3.2:3b`. |
| `CONTACT_NOTIFICATION_EMAIL` | Where contact-form notifications go. Console email when `EMAIL_HOST` is empty. |
| `SERVE_MEDIA` | Serve uploads through Django (fine for a small portfolio). |

`auto` uses Groq when `GROQ_API_KEY` is set, then Ollama, then the extractive answerer. The extractive path needs no model and always produces a grounded answer from retrieved records.

## API surface

Public (no auth):

- `GET /api/v1/site/` — one payload with profile, stats, skills, projects, journey, certifications, achievements, FAQs, suggestions and JSON-LD.
- `GET /api/v1/projects/<slug>/` — full case study.
- `POST /api/v1/contact/` — contact form, honeypot + throttling.
- `GET /api/v1/chat/suggestions/`
- `POST /api/v1/chat/` — JSON answer.
- `POST /api/v1/chat/stream/` — SSE (`meta`, `delta`, `done`, `error`), `Accept: text/event-stream`.
- `GET /api/v1/sitemap.xml` and `GET /api/v1/robots.txt` — generated from the database.
- `GET /api/v1/health/`

Auth:

- `POST /api/v1/auth/token/` → access + refresh + user
- `POST /api/v1/auth/token/refresh/`
- `POST /api/v1/auth/logout/` — blacklists the supplied refresh token
- `GET /api/v1/auth/me/`

Admin (`Authorization: Bearer <access>`, staff only):

- `GET|PATCH /api/v1/admin/profile/`
- `GET /api/v1/admin/dashboard/`
- Full CRUD: `/admin/projects/`, `/admin/projects/screenshots/`, `/admin/skills/`, `/admin/skills/categories/`, `/admin/education/`, `/admin/experience/`, `/admin/certifications/`, `/admin/achievements/`, `/admin/faqs/`, `/admin/social-links/`, `/admin/chatbot/suggestions/`
- `/admin/messages/` — list, mark read, delete
- `/admin/chat-logs/` — read-only assistant analytics

## Content is single-source

The public site never hard-codes biography, project, skill or certification data. The chatbot's retrieval layer reads the same models, so an admin edit changes the site, the SEO payload and the assistant together. Stats are computed (completed/ongoing counts, certs in progress) rather than typed in.

The legacy inconsistencies (10 certs vs “9+”, training listed as certifications, two skill lists) were resolved during seeding; statuses are explicit and the site only presents completed items as completed.

## Chatbot behaviour

1. Request passes a prompt-injection guard and a 12/min throttle.
2. Retrieval scores visible database records (keyword + phrase matching) and returns the best grounded context plus source chips.
3. The provider streams a short answer constrained to that context.
4. If no provider is reachable, an extractive answerer composes the reply from the retrieved rows, so the widget still works on a free host with no model.
5. Every exchange is logged for the admin panel; flagged requests are marked.

## Tests and checks

```bash
cd backend
DEBUG=True SECRET_KEY=dev-test python manage.py test      # 68 tests, 1 skipped
python manage.py check --deploy                          # must report no issues

# Production-only header assertions (HSTS, secure cookies):
PRODUCTION_TEST=1 DEBUG=False SECURE_SSL_REDIRECT=False \
  SECRET_KEY="$SECRET_KEY" python manage.py test content.test_security.ProductionHeaderTests

cd site && npm run typecheck && npm run build
cd admin && npm run typecheck && npm run build

# Dependency checks used for this release
pip-audit -r backend/requirements.txt
(cd site && npm audit --omit=dev)
(cd admin && npm audit --omit=dev)
```

Backend tests cover the public payload, admin permissions, JWT auth, contact validation/throttling, prompt-injection refusal, streaming, retrieval grounding, upload validation, security headers and audit logging. `SECURITY.md` records the threat model, the controls and the known limits; `docs/audit-report.md` records the release audit, including the checks that could not be run locally.

The site build runs `scripts/generate-sitemap.mjs` first. It fetches `/api/v1/site/` and writes `site/public/sitemap.xml` and `robots.txt`; if the API is unreachable it keeps the previous sitemap. Set `SITEMAP_API_URL` when building against a non-default API, and `SITE_ORIGIN` to override the canonical origin.

## Deployment

See [docs/deployment.md](docs/deployment.md) for the full runbook: hosts, environment variables, PostgreSQL, static files, backups, migration/rollback procedure and post-deploy checks. Summary:

- **API**: Python host (Render/Railway/Fly) with PostgreSQL. `pip install -r backend/requirements-prod.txt`, `migrate`, `collectstatic`, Gunicorn on `config.wsgi`. Set `DEBUG=False`, a real `SECRET_KEY`, `ALLOWED_HOSTS`, `NUM_PROXIES=1`, and HTTPS origins. HSTS, secure cookies and SSL redirect switch on automatically when `DEBUG=False`.
- **Media**: `SERVE_MEDIA` works for low traffic; point it at S3/R2 and set `MEDIA_URL` if uploads grow.
- **Site / admin**: static hosts (Netlify/Cloudflare Pages/Vercel). Build with `VITE_API_URL` set to the deployed API. `site/public/_redirects` and `admin/public/_redirects` provide SPA fallback; `_headers` adds frame, nosniff, referrer and HSTS headers.
- **CORS**: add the deployed origins to `CORS_ALLOWED_ORIGINS`; keep `CORS_ALLOW_CREDENTIALS=False` (JWT lives in `localStorage`).
- **Secrets**: `GROQ_API_KEY` and email credentials belong in the host's secret store, never in the repo.

## Before going live

- Upload a résumé PDF and a 1200×630 social image in **Profile & SEO** (the dashboard checklist tracks this).
- Add cover images/screenshots to projects — the current cards use generated artwork, not real screenshots.
- Replace the single seeded lab entry with real TryHackMe/HTB/CTF progress if available.
- Generate a fresh `SECRET_KEY` for the deployment. The legacy repository history contains an old hard-coded Django key; that key must never be reused. Rotating it only invalidates existing sessions.
- Create a dedicated staff account instead of reusing a superuser, and keep `DEBUG=False`.
