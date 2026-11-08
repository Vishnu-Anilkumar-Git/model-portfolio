# Release audit report

Date: 8 November 2026
Scope: security hardening, QA and deployment readiness for the portfolio platform (`backend/`, `site/`, `admin/`).
Environment: local Windows development machine; Django test runner against a temporary SQLite database; Vite dev/preview servers; Chromium driven through the browser preview.

This report records what was actually run. Anything that was not executed is listed under **Not verified** rather than claimed as working.

## Verification results

| Check | Command | Result |
| --- | --- | --- |
| Backend test suite | `DEBUG=True SECRET_KEY=dev-test python manage.py test` | **68 tests, 0 failures, 0 errors, 1 skipped** (66 s) |
| Production header test | `PRODUCTION_TEST=1 DEBUG=False SECURE_SSL_REDIRECT=False SECRET_KEY=… python manage.py test content.test_security.ProductionHeaderTests` | Passed |
| Django deployment check | `DEBUG=False` with a freshly generated `SECRET_KEY`, `python manage.py check --deploy` | **No issues** |
| Static collection | `DEBUG=False` with a freshly generated `SECRET_KEY`, `python manage.py collectstatic --noinput` | 157 files copied, 408 post-processed |
| Site typecheck | `cd site && npm run typecheck` | Passed |
| Site production build | `cd site && npm run build` | Passed (8.2 s); one chunk > 500 kB warning |
| Admin typecheck | `cd admin && npm run typecheck` | Passed |
| Admin production build | `cd admin && npm run build` | Passed (3.8 s) |
| Python dependency audit | `pip-audit -r backend/requirements.txt` | **No known vulnerabilities** |
| npm audit (site) | `npm audit --omit=dev` | **0 vulnerabilities** |
| npm audit (admin) | `npm audit --omit=dev` | **0 vulnerabilities** |
| Lighthouse (site, local preview) | Lighthouse against `http://127.0.0.1:4173/` | Performance **72**, Accessibility **100**, Best practices **100**, SEO **100** |

The skipped test is the production-only header assertion; it is excluded by default because it needs `DEBUG=False` and a real key, and it passes when run explicitly. The earlier baseline of 37 tests grew to 68 with the security and content coverage added in this phase.

Lighthouse metrics on the local preview: FCP 1.8 s, LCP 3.4 s, TBT 740 ms, CLS 0.005. The preview server does not compress or cache assets the way a CDN does, so the deployed score should be higher — but that has not been measured.

## What was audited

### Authentication and authorization

- Admin endpoints without a token → 401.
- Expired access token → 401.
- Payload-modified token → 401.
- Token signed with a different key → 401.
- Malformed `Authorization` header → 401.
- Valid token for a non-staff account → 403 on every admin endpoint.
- Visitor attempting to read another account → no public endpoint exposes accounts; contact messages and chat logs are staff-only.
- Logout blacklists the refresh token; a malformed token does not raise.
- Failed logins are logged with username and IP, without the password, and admin changes are logged with field names only.

### Rate limits and brute force

- JWT login throttle (10/min) blocks a password-spray loop.
- Django admin sign-in (10 attempts / 5 min / IP) is throttled by middleware; other admin POSTs are unaffected.
- Chat (12/min) and contact (5/hour) throttles return 429 under load.
- Honeypot submissions to the contact form are accepted silently and never stored or emailed.

### Injection and XSS

- SQL syntax in admin search is handled by the ORM and does not alter the query.
- Path traversal in a project slug returns 404.
- Markup stored in a content field is returned as data; React escapes it and it is not rendered as HTML.
- No unescaped HTML rendering of database content in the site or admin.
- The site CSP restricts scripts to the site origin plus inline JSON-LD; the admin allows only its own bundle.

### File uploads

- A valid PNG avatar is accepted and served with a sandbox CSP.
- SVG is rejected.
- A non-image renamed to `.png` is rejected by Pillow verification.
- An oversized avatar is rejected.
- A résumé must start with `%PDF-` and have a PDF content type; a renamed text file is rejected.
- An oversized résumé is rejected.
- Double extensions (e.g. `evil.html.png`) are covered by content verification, not just the extension check.

### Assistant prompt injection

- “Ignore previous instructions”, system-prompt extraction, credential fishing, jailbreak/DAN phrasing, “act as the developer”, base64 follow-up instructions and similar patterns are refused and flagged.
- Instructions smuggled through a previous assistant/user turn in the client-supplied history are also refused.
- Ordinary questions that merely contain words like “API” still work (the old substring filter rejected them).
- Provider output containing the system prompt or context header is replaced with a refusal.
- Unknown questions return a grounded “I don't have that information” rather than an invented answer.
- With no provider reachable, the extractive fallback still answers from database rows (tested).

### Secrets

- `git ls-files` shows no tracked `.env`, key or PEM file.
- `.gitignore` covers `.env`, `.env.*` (except `.env.example`), databases, media, static files, `node_modules` and build output.
- The current tree has no hard-coded secret.
- One early legacy commit contains a hard-coded Django `SECRET_KEY`. It is not referenced by the current code, but it remains recoverable from history and must never be reused. A fresh key is required for deployment.

### Security headers and transport

- API responses carry CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, COOP, and `Cache-Control: no-store`.
- Media responses carry a sandbox CSP and cross-origin resource policy.
- With `DEBUG=False`: HSTS (one year, includeSubDomains, preload), SSL redirect, secure session and CSRF cookies.
- The site and admin bundles ship `_headers` with frame denial, nosniff, referrer policy and HSTS; the site adds a build-time meta CSP.
- CORS allows the configured origins only and rejects an unknown origin; credentials are disabled.

## What was fixed in this phase

| Fix | Detail |
| --- | --- |
| Dependency CVEs | `pip-audit` flagged Django 6.1 and DRF 3.18.0; pinned Django 6.1.1 and DRF 3.18.2. Audits are now clean. |
| Upload validation | Shared validators for images and résumés: size caps, extension allowlist, content-type check, Pillow verify and PDF signature check. |
| Upload abuse surface | Media is served with a sandbox CSP and cannot execute as a page on the API origin. |
| Admin login brute force | Middleware throttles the Django admin form, which Django does not throttle by default. |
| Audit logging | Admin create/update/delete actions are logged with actor, object and changed field names; values are never logged. |
| Failed-login logging | JWT failures log username and IP, never the submitted password. |
| Security headers | CSP middleware, Permissions-Policy, COOP, `no-store` on API responses, media sandbox policy. |
| Frontend headers | `_headers` for the site and admin; build-time meta CSP for the site. |
| Token lifecycle | Logout blacklists the refresh token; rotation and blacklist-after-rotation enabled. |
| Rate limits | Scoped throttles for login, chat and contact; `NUM_PROXIES` support for correct client IPs behind a proxy. |
| Repository hygiene | Ignore build output, media, static files and databases; `.env.example` documents every variable without values. |
| Sitemap/robots | Generated from visible database rows at the API and written at build time for the static site. |

## Manual QA performed

- Public site: home, project list tabs, project detail page, FAQ, contact.
- Admin: sign-in, profile edit and save, project create/edit/delete, screenshot upload, messages (read/delete), chat logs, sign-out.
- Chatbot: streaming response with source chips, non-streaming fallback, extractive answer with no model, refused prompt-injection attempt.
- Layout: no horizontal overflow at 390 px; skip link, visible focus rings and Escape-to-close on the chat widget checked. Not a screen-reader pass.
- No console errors were observed during these checks.

## Not verified

- **Live deployment.** No host credentials or authorization were available; nothing was deployed to `vishnuanilkumar.in`. The runbook is untested against a real host.
- **Hosted model.** No Groq key was configured, so only the extractive fallback was exercised. A real Groq streaming call and its latency/error behaviour are unmeasured.
- **Email delivery.** SMTP was not configured; the console backend was used, so real delivery, SPF/DKIM and spam placement are untested.
- **Shared-cache throttling.** Limits were tested with the default per-process cache. Behaviour with Redis and multiple Gunicorn workers is untested.
- **Lighthouse on the deployed CDN.** The 72/100/100/100 result is from a local preview without compression. Production scores were not measured.
- **Load and stress testing.** No concurrency, soak or large-payload test was run.
- **Independent security review.** No third-party penetration test; the findings are from the project's own suite and manual probing.
- **Real devices and assistive technology.** Responsive layout was checked by resizing the browser, not on physical phones; no VoiceOver/NVDA pass.
- **Malware scanning.** Uploads are type- and size-validated but not virus-scanned.
- **Media at scale.** No object storage or CDN path was exercised.
- **Account isolation between two real staff accounts.** The suite verifies staff-vs-non-staff and token rejection; it does not create two staff users and compare their views, because the content model is shared by design.

## Remaining work before launch

1. Generate and store a fresh `SECRET_KEY`; never reuse the historical one.
2. Create PostgreSQL, apply migrations, configure a daily backup and perform one restore drill.
3. Configure SMTP and send a test contact notification.
4. Optionally set `GROQ_API_KEY`; otherwise accept the extractive assistant.
5. Build the site against the deployed API so the sitemap includes real projects.
6. Upload the résumé, social image and real project screenshots through the admin.
7. Create a dedicated staff account and keep the superuser unused.
8. Run the post-deploy checks in `docs/deployment.md`, including headers and an end-to-end chatbot answer.

## Verdict

The application is functionally complete, the automated suite and both production builds pass, and the dependency audits are clean. The code-level security findings from this audit are fixed. Launch is blocked only on operational steps (host, database, secrets, email, content uploads) and on verifying the deployed environment — not on known application defects.
