# Architecture

## Why one database

The original site kept content in three places: a 1,093-line `index.html`, six chatbot JSON files, and inline JSON-LD. They had already diverged (a “9+ certs” stat next to ten cards, training entries presented as certifications, two different skill lists, projects missing from the assistant's knowledge). Every extra copy was a future inconsistency.

The rewrite makes Django models the only source:

- `GET /api/v1/site/` hydrates the entire public page in one request.
- The chatbot retrieval layer queries the same models and base-queries the same visibility rules.
- JSON-LD (`Person`, `WebSite`, `FAQPage`) is generated server-side from the same rows.
- Stats are computed from rows, never stored as copy.

`seed_portfolio` is the bridge from the legacy content. It is idempotent and only creates missing rows, so it can run on a fresh database without stomping admin edits.

## Content model

`Profile` is a singleton (`pk=1`) holding identity, bio, links, files, SEO defaults and assistant copy. The rest are ordered, visibility-flagged collections:

- `Project` (+ `ProjectScreenshot`) — case studies with status, progress, stack, dates, highlights, architecture notes and learnings.
- `SkillCategory` → `Skill`
- `Education`, `Experience`
- `Certification` — category distinguishes certification from training; status distinguishes in progress / completed / planned.
- `Achievement` — labs, CTFs, awards.
- `FAQ`, `SocialLink`, `SuggestedQuestion`
- `ContactMessage`, `ChatLog` — write-only from the public side, read-only or limited actions in admin.

Ordering is `(order, pk)`. Public endpoints filter `visible=True` (skills additionally filter the child `Skill.visible`).

## Public payload

`SiteView` performs a fixed number of queries (with `prefetch_related` for skills and screenshots), computes counts, builds JSON-LD and returns:

```
profile, stats, socials, skills[], projects[], education[], experience[],
certifications[], achievements[], faqs[], suggested_questions[],
seo { title, description, canonical, og_image, json_ld[] }, meta
```

`ProjectListSerializer` exposes `tech[]` and a derived `timeline` label. The detail serializer adds paragraphs (`description`, `architecture`), highlights, learnings and screenshots.

Media URLs are absolute when a request is in serializer context; otherwise relative. This keeps the API usable by the VM-hosted site and by admin previews.

## Chatbot pipeline

`prepare_chat()` (in `chatbot/services/chat.py`):

1. Normalise the message; cap history to six turns / 3,000 characters (serializer).
2. Run the injection guard. It looks for instruction-override patterns, prompt-extraction requests and credential fishing, and returns a fixed refusal plus `flagged=True` instead of answering. Unlike the old substring block, ordinary questions containing words like “API” are not rejected.
3. Retrieve context from the database. The scorer combines token overlap, phrase hits and field weights across profile, projects, skills, certifications, education/experience, achievements and FAQs. It returns the top `CHATBOT_RETRIEVAL_LIMIT` records with source chips (`label`, `url`, `kind`).
4. Build the grounded prompt: answer only from context, say when information is missing, never invent certifications or dates, keep it short.

`generate_answer()` tries the configured provider chain. Each provider exposes a `stream()` generator; failures fall through to the next. The final fallback is `extractive`, which composes a reply from the retrieved records so the assistant remains useful with no model available.

Logging records question, answer, sources, provider, latency, session and flag state. `ChatLog` is exposed read-only in admin.

## Streaming contract

`POST /api/v1/chat/stream/` returns `text/event-stream` regardless of DRF's renderer negotiation (the view overrides content negotiation; this is what fixed the earlier 406). Events:

```
event: meta   data: { sources, session_id, flagged }
event: delta  data: { text }            # repeated
event: done   data: { provider, latency_ms, flagged }
event: error  data: { message }         # on provider failure after meta
```

The client (`site/src/hooks/useChat.ts`) parses frames incrementally, appends deltas, and falls back to the non-streaming endpoint if streaming fails. History persists in `localStorage`; the server never trusts it beyond grounding turns.

## Admin panel

A separate SPA on its own origin. Login exchanges username/password for a SimpleJWT access/refresh pair; the client stores them in `localStorage`, attaches `Bearer` headers, and silently refreshes once on 401 before signing out.

The panel is driven by declarative resource configs (`admin/src/lib/resources.ts`): fields, types, options, relations and table columns. One generic `ResourcePage` provides search, filters, pagination, create/edit modals with per-field server errors, and delete confirmation. Files upload separately via multipart PATCH after the JSON save, avoiding the empty-value problems of multipart for nullable numbers/dates.

Notable behaviours:

- `Profile` is a singleton editor with sectioned fields and three uploads (avatar, résumé, social image).
- Messages auto-mark read on open and support mark-unread/delete/reply.
- Chat logs are read-only with a flagged filter and source chips.
- The dashboard aggregates counts, a launch-readiness checklist and recent activity.

## Security notes

- `DEBUG` defaults to `False`; `SECRET_KEY` has no production fallback.
- Staff-only admin viewsets (`IsAdminUser`); public views opt in to `AllowAny` explicitly.
- Scoped throttles: chat 12/min, contact 5/hour, login 10/min.
- HSTS, SSL redirect, secure cookies and `X-Frame-Options: DENY` are enabled when `DEBUG=False`; a middleware adds CSP/nosniff/referrer headers.
- Contact submissions hash the client IP and store a truncated user agent; honeypot fields are accepted silently.
- CORS is an allowlist with credentials disabled; JWT is not cookie-based, so CSRF surface stays small.

## Sitemap and robots

`content/sitemap.py` builds both files from the same visible project rows. They are exposed at `/api/v1/sitemap.xml`, `/api/v1/robots.txt` and at the API root. Because the public site is static, `site/scripts/generate-sitemap.mjs` fetches `/api/v1/site/` during `npm run build` and writes the same files into `site/public/`, so the deployed domain serves a database-backed sitemap without a proxy.

## Known gaps

- Project cards currently rely on generated artwork; real screenshots need to be uploaded through the admin.
- Media is served by Django by default; move to object storage before traffic grows.
- Rate limits use Django's local-memory cache. On a multi-worker deployment each worker keeps its own counter, so set a shared cache (Redis) if you scale horizontally.
- The public site CSP allows inline scripts because JSON-LD is injected at runtime. A nonce-based CSP would need SSR/SSG.
- No analytics by design.
