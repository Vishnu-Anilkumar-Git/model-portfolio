# Security

Last reviewed: 8 November 2026.

This document covers the Django API (`backend/`), the admin SPA (`admin/`) and the public site (`site/`). It records the threat model, the controls that are actually in the code, what was tested, what was fixed, and the limits that remain.

## Threat model

| Asset | Why it matters | Exposure |
| --- | --- | --- |
| Staff credentials and JWT refresh tokens | Full control over published content and contact messages | Admin login, `/api/v1/auth/*` |
| `SECRET_KEY` | Forges sessions and JWTs; compromises every auth control | Server environment only |
| Contact messages | Names, emails and private messages from visitors | Staff-only admin API |
| Chat logs | Visitor questions, IP-free but still user text | Staff-only admin API |
| Published content | Reputation; the site is the public CV | Public read, staff write |
| API availability | Chat, contact and the site payload depend on it | Public internet |
| Uploaded media | Served from the API origin | Public `/media/` |

Adversaries considered:

- **Anonymous visitor** — reads public content, spams the contact form or assistant, probes admin endpoints.
- **Authenticated non-staff user** — there is no public registration, but a mistakenly created non-staff account must not reach admin data.
- **Token attacker** — sends no token, an expired token, a modified token, or a token signed with a different key.
- **Malicious or careless editor** — a staff account is trusted to publish, but uploads and mutations are constrained and audited.
- **Automated bot** — credential stuffing, prompt injection, and request floods.
- **Supply chain** — a vulnerable dependency in the API or a frontend bundle.

Out of scope: host or OS compromise, DNS/registrar takeover, volumetric DDoS beyond what the hosting platform absorbs, physical access, and social engineering of the owner. A compromised staff account is treated as a detection-and-recovery problem (audit log plus token revocation), not a preventable one.

## Controls

### Authentication and authorization

- SimpleJWT: 30-minute access tokens, 7-day refresh tokens, rotation with blacklist after rotation (`ROTATE_REFRESH_TOKENS`, `BLACKLIST_AFTER_ROTATION`). Logout blacklists the supplied refresh token; a garbage token is accepted without an error.
- DRF denies by default (`DEFAULT_PERMISSION_CLASSES = IsAuthenticated`). Public endpoints opt in to `AllowAny` explicitly; every admin viewset uses `IsAdminUser`.
- Staff status is checked server-side on every admin request. Non-staff users receive 403 even with a valid token.
- There is no public sign-up, no password reset endpoint and no user-owned data in the public API. Contact messages and chat logs are readable only by staff.
- Password validators are enabled for the Django admin account. The owner is expected to create a dedicated staff account rather than browse with a superuser.

### Rate limits

| Surface | Limit | Implementation |
| --- | --- | --- |
| JWT login | 10/min per client IP | `ScopedRateThrottle`, scope `login` |
| Chat (JSON and SSE) | 12/min per client IP | `ScopedRateThrottle`, scope `chat` |
| Contact form | 5/hour per client IP | `ScopedRateThrottle`, scope `contact` |
| Django admin sign-in | 10 attempts / 5 min per IP | `AdminLoginThrottleMiddleware` |

Counters live in Django's cache. The default is `LocMemCache`, which is per process: with several Gunicorn workers each worker enforces its own limit, so the effective limit multiplies by the worker count. A shared cache (Redis) is required before scaling horizontally. Set `NUM_PROXIES=1` on Render/Railway so DRF derives the client IP from the proxy header; leaving it unset on a proxied host would make every visitor share one bucket, and setting it too high would let clients spoof `X-Forwarded-For`. The Django-admin throttle deliberately uses `REMOTE_ADDR` only.

### Input handling and uploads

- All writes go through DRF serializers with explicit field validation; queries use the ORM with bound parameters, so admin search and slug lookups are not injectable (there is a test that posts SQL syntax into admin search).
- Project slugs are resolved by exact slug lookup; path traversal attempts return 404.
- Requests are capped at 5 MB (`DATA_UPLOAD_MAX_MEMORY_SIZE`, `FILE_UPLOAD_MAX_MEMORY_SIZE`).
- Image uploads (avatar, project image, badge, social image) must have an allowed extension and content type, are parsed and verified by Pillow, must be one of JPEG/PNG/WebP/GIF/AVIF, and are capped at 2 MB (avatar, badge) or 5 MB (project, social image). SVG and polyglot files are rejected.
- The résumé must be a real PDF (`%PDF-` signature), `application/pdf`, and at most 5 MB.
- Media responses carry `Content-Security-Policy: default-src 'none'; img-src 'self' data:; sandbox` and `Cross-Origin-Resource-Policy: cross-origin`, so an uploaded document cannot execute as a page on the API origin.
- The contact form validates the email address, enforces a maximum length, and silently accepts honeypot submissions without storing or notifying. It stores a hash of the client IP and a truncated user agent, never the raw IP.

### Output and XSS

- All database content is rendered as text by React, which escapes interpolated values; there is a test asserting that markup stored in a content field comes back as data, not HTML.
- The public site's CSP is generated at build time (`site/vite.config.ts`) and is injected as a meta tag. Inline scripts are allowed because JSON-LD is injected at runtime; every other source is limited to the site origin and the configured API origin.
- The assistant renders answers as text. Provider output that contains prompt markers is replaced with a refusal before it reaches the client or the log.
- The admin bundle carries its own `_headers` file with `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow` and HSTS.

### Chatbot guardrails

- Instruction-override, prompt-extraction, credential-fishing and jailbreak patterns are blocked with a fixed refusal and logged as `flagged`.
- Client-supplied conversation history is untrusted: every history turn is scanned, not just the latest message, and history is bounded to six turns / 3,000 characters.
- Retrieval only uses visible database rows. The prompt instructs the model to answer solely from that context, say when something is unknown, and never invent certifications or dates.
- Answers are capped at 1,500 characters server-side; a provider outage falls back to a deterministic extractive answer built from the same rows.

### Transport and headers

With `DEBUG=False`:

- `SECURE_SSL_REDIRECT=True`, HSTS for one year with `includeSubDomains` and `preload`, secure session/CSRF cookies, `X-Frame-Options: DENY`, `SECURE_CONTENT_TYPE_NOSNIFF`, and `Referrer-Policy: strict-origin-when-cross-origin`.
- `SecurityHeadersMiddleware` adds CSP, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `X-Permitted-Cross-Domain-Policies: none`, and `Cache-Control: no-store` on `/api/`.
- `SECURE_PROXY_SSL_HEADER` trusts `X-Forwarded-Proto`; this is only correct behind a proxy that overwrites the header.
- CORS is an origin allowlist restricted to `/api/*` with credentials disabled. The SPAs send `Authorization` headers, not cookies, so there is no cross-site cookie surface. `CSRF_TRUSTED_ORIGINS` is empty unless configured for a deployment that uses the Django admin through a proxy.
- The public site serves `_headers` with frame denial, nosniff, referrer policy, a restrictive Permissions-Policy and HSTS. A meta CSP cannot express `frame-ancestors`, so clickjacking protection for the static site comes from `X-Frame-Options` in `_headers`.

### Secrets

- Secrets come from environment variables only (`backend/.env` locally, host secret store in production). `.env` is git-ignored and `.env.example` contains no values.
- Production refuses to start without `SECRET_KEY`; there is no production fallback.
- The current tree contains no tracked `.env`, key or PEM file.
- **Known historical exposure:** an early legacy commit contains a hard-coded Django `SECRET_KEY`. It is not used by the current code, but it must never be reused, and a fresh key must be generated for the deployment (see `docs/deployment.md`).

### Logging and monitoring

- `content.audit` logs authenticated content changes as `action`, `model`, `pk`, `user`, `ip` and the *names* of changed fields. Values are never logged.
- `content.security` logs blocked admin-login attempts and failed JWT logins with the username and IP, never the password.
- Chat logs store question, answer, sources, provider, latency, session ID and flag state for admin review.
- Logs go to stdout for the platform to collect. No tokens, passwords or message bodies are written to security logs.

### Dependencies

Python and npm dependencies are pinned in `backend/requirements*.txt`, `site/package-lock.json` and `admin/package-lock.json`. Both audits are clean as of this review:

```bash
cd backend && pip-audit -r requirements.txt -r requirements-prod.txt
cd site && npm audit --omit=dev
cd admin && npm audit --omit=dev
```

Upgrade procedure: change the pin, install, run the full backend suite and both builds, then re-run the audits. Do not upgrade Django across a major version without re-running `manage.py check --deploy`.

## Audit results

The automated coverage lives in `backend/content/test_security.py`, with additional coverage in `content/tests.py` and `chatbot/tests.py`. The complete suite is 68 tests (1 production-only test is skipped unless `PRODUCTION_TEST=1`).

| Check | Result |
| --- | --- |
| Admin endpoints with no, expired, tampered, wrong-key or malformed tokens | Rejected (401) |
| Non-staff token against admin endpoints | Rejected (403) |
| Visitor reading another account's data | No endpoint exposes it; contact messages and logs are staff-only |
| Logout with a valid and a garbage refresh token | Blacklists / no error |
| Login brute force, Django admin brute force, chat and contact floods | Throttled (429) |
| SQL syntax in admin search, traversal in project slugs | No injection; 404 |
| Markup stored in content fields | Returned as data, not rendered as HTML |
| Image and résumé upload abuse (SVG, disguised file, oversized, double extension) | Rejected by validators |
| Valid avatar upload and media headers | Accepted; media served sandboxed |
| Prompt injection, prompt extraction, hostile client history, regular questions | Refused/flagged as intended; legitimate questions still answer |
| Provider echoing the system prompt | Replaced with refusal |
| Security headers and `no-store` on API responses | Present |
| HSTS and secure cookies with `DEBUG=False` | Present (`PRODUCTION_TEST=1`) |
| Dependency vulnerabilities | None known after upgrades |
| Tracked secrets | None in the current tree; one historical key requires rotation |

## Findings fixed during the audit

| Finding | Severity | Resolution |
| --- | --- | --- |
| `pip-audit` reported known CVEs in Django 6.1 and DRF 3.18.0 | High | Pinned Django 6.1.1 and DRF 3.18.2; audits now clean |
| Uploads had no size cap or content verification | Medium | Shared validators for images and the résumé PDF |
| The Django admin login form had no throttle | Medium | `AdminLoginThrottleMiddleware` (10 attempts / 5 min / IP) |
| Admin changes were not auditable | Medium | Structured `content.audit` logging with field names only |
| API responses could be cached by intermediaries | Low | `Cache-Control: no-store` on `/api/` |
| No CSP on API/media responses | Low | CSP middleware, plus a stricter sandbox policy for `/media/` |
| Frontend assets had no security headers | Low | `_headers` for the site and admin bundles; build-time meta CSP for the site |

## Known limits

- **Historical `SECRET_KEY`** remains in Git history. Code cannot remove it; generate a new key for production and never restore the old one.
- **Rate limits are per process** with the default cache. A multi-worker deployment needs Redis or another shared cache for exact limits.
- **No MFA** on the admin account. Use a long unique password and, where the host allows it, IP restriction on `/admin/`.
- **Uploads are validated, not malware-scanned.** Only staff can upload, and media is sandboxed, but there is no antivirus integration.
- **Media is served by Django** (`SERVE_MEDIA=True`) on the API origin. Move to object storage with a separate origin if uploads grow or if the API origin must never serve user files.
- **The public site CSP allows inline scripts** because JSON-LD is injected at runtime. Removing it requires server-side rendering or a nonce.
- **JWT is stored in `localStorage`**, so any successful XSS in the admin panel could steal a token. The admin has no user-generated HTML, a strict CSP and a short access-token lifetime, but an httpOnly cookie design would be stronger.
- **The Django admin is publicly reachable** at `/admin/` (throttled, staff-only). Restrict it at the proxy if convenient.
- **No independent penetration test, load test or WAF** has been performed. The results above come from the project's own test suite and manual checks.
- **Third-party inference**: when Groq is configured, the retrieved public portfolio context and the visitor's question are sent to Groq. Do not put private data in the knowledge base.
- **Email delivery** uses the console backend unless SMTP is configured, so contact notifications are not delivered in development.

## Reporting a vulnerability

Email **vishnuanil2k05@gmail.com** with the affected endpoint, a reproduction and the impact. Please do not open a public issue or test against the production site in a way that affects other visitors.
