# Deployment runbook

Target: **vishnuanilkumar.in** (public site), **admin.vishnuanilkumar.in** (admin panel) and **api.vishnuanilkumar.in** (Django API). The three are deployed independently: the API is a Python service with a database; the two frontends are static bundles.

```
Cloudflare DNS
├── vishnuanilkumar.in        → static host (Cloudflare Pages or Netlify)
├── www.vishnuanilkumar.in    → redirect to apex
├── admin.vishnuanilkumar.in  → static host (separate project)
└── api.vishnuanilkumar.in    → Render / Railway / Fly (Django + PostgreSQL)
```

Nothing in this guide has been executed against a live host from this checkout. Treat the commands as the procedure to follow, and run the post-deploy checks before announcing the site.

## 1. Prerequisites

- Python 3.12+ on the API host, Node 20+ for local builds (the static hosts build with their own Node image).
- A PostgreSQL instance. SQLite is for local development only.
- A generated `SECRET_KEY`:

```bash
python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
```

- A Groq API key if you want a hosted model. Without it, `CHATBOT_PROVIDER=auto` falls back to Ollama (not available on most hosts) and then to the extractive answerer, so the assistant keeps working from the database.
- DNS access for the four names above.

## 2. API service

### Build and release commands

On a host where the repository root is the build context and the service root directory is `backend`:

```bash
# build
pip install -r requirements-prod.txt
python manage.py collectstatic --noinput

# release (run once per deploy, before the new process takes traffic)
python manage.py migrate --noinput

# start
gunicorn config.wsgi:application \
  --bind 0.0.0.0:$PORT \
  --workers 3 \
  --timeout 60 \
  --access-logfile -
```

If the host does not support a service root directory, run the same commands from the repository root with `--chdir backend`:

```bash
pip install -r backend/requirements-prod.txt
python backend/manage.py collectstatic --noinput
python backend/manage.py migrate --noinput
gunicorn --chdir backend config.wsgi:application --bind 0.0.0.0:$PORT --workers 3 --timeout 60
```

`requirements-prod.txt` adds Gunicorn and psycopg. WhiteNoise serves the collected static files (the Django admin and DRF assets) from the API process; media is served by Django while `SERVE_MEDIA=True`.

### Environment variables

Set these in the host's secret store, not in the repository.

| Variable | Production value | Notes |
| --- | --- | --- |
| `DEBUG` | `False` | Required. Enables HSTS, secure cookies and the SSL redirect. |
| `SECRET_KEY` | freshly generated | Required; the app refuses to start without it. Never reuse the historical key. |
| `ALLOWED_HOSTS` | `api.vishnuanilkumar.in` | Comma-separated; include the platform health host if it probes by IP. |
| `DATABASE_URL` | `postgres://…` | Managed PostgreSQL connection string. Add `?sslmode=require` if the provider requires TLS. |
| `CORS_ALLOWED_ORIGINS` | `https://vishnuanilkumar.in,https://www.vishnuanilkumar.in,https://admin.vishnuanilkumar.in` | Exact origins, no trailing slash. |
| `CSRF_TRUSTED_ORIGINS` | `https://api.vishnuanilkumar.in` | Only needed for the Django admin over HTTPS. |
| `SITE_URL` | `https://vishnuanilkumar.in` | Canonical links and chatbot source chips. |
| `ADMIN_URL` | `https://admin.vishnuanilkumar.in` | Used for admin links in notifications. |
| `SITE_REBUILD_HOOK_URL` | build-hook URL | Optional. Server-side only. When set, published content writes and the admin **Publish site** button POST to it. Leave unset to disable automatic publishing. Never expose this as a `VITE_*` variable. |
| `NUM_PROXIES` | `1` | Render/Railway sit behind one proxy. Adjust only if the topology changes; otherwise throttling uses the wrong IP. |
| `SECURE_SSL_REDIRECT` | unset | Defaults to `True` when `DEBUG=False`. |
| `SERVE_MEDIA` | `True` | Keep until uploads move to object storage. |
| `GROQ_API_KEY` | key | Optional; without it the assistant uses the extractive fallback. |
| `LLM_BASE_URL` / `LLM_MODEL` | defaults | Groq's OpenAI-compatible endpoint and `llama-3.3-70b-versatile`. |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` | SMTP provider | Empty `EMAIL_HOST` uses the console backend and contact notifications are not delivered. |
| `CONTACT_NOTIFICATION_EMAIL` | destination inbox | Defaults to the owner's address. |
| `DEFAULT_FROM_EMAIL` | verified sender | Must be allowed by the SMTP provider. |

`ALLOWED_HOSTS` must match the public API hostname, not the site hostname. After the first deploy, run `python manage.py createsuperuser` once (or create a dedicated staff user) from the host shell.

### Database

Use managed PostgreSQL. The app reads `DATABASE_URL` through `dj-database-url`; without it, it falls back to SQLite, which is not suitable for a host with an ephemeral disk.

Migrations are forward-only in normal operation. Keep them additive (new nullable columns, new tables, backfills in a separate step) so the previous release can still run against the new schema during a rollback window.

Backups:

```bash
# daily logical backup, custom format, timestamped
pg_dump --format=custom --no-owner --no-acl \
  --file="portfolio-$(date +%F).dump" "$DATABASE_URL"

# keep 14 daily + 4 weekly copies off the database host
# restore into a scratch database at least monthly to prove the backup works
createdb portfolio_restore_test
pg_restore --clean --if-exists --no-owner --no-acl \
  --dbname=portfolio_restore_test portfolio-2026-11-08.dump
```

Also enable the provider's automated snapshots and point-in-time recovery if it offers them. A backup that has never been restored is not a backup.

### Media and static files

- `collectstatic` writes to `backend/staticfiles/`; WhiteNoise serves it with hashed, compressed filenames in production. Run `collectstatic` on every deploy.
- Uploaded media goes to `backend/media/`. On a host with an ephemeral filesystem, mount a persistent disk or move media to S3/R2 **before** the first real upload. To move later: set `SERVE_MEDIA=False`, point `MEDIA_URL` at the bucket/CDN, migrate the files, and keep the old paths working.
- The upload limit is 5 MB per request; individual image limits are 2–5 MB and the résumé is capped at 5 MB.

## 3. Public site

Build from `site/`:

```bash
cd site
npm ci
VITE_API_URL=https://api.vishnuanilkumar.in/api/v1 \
SITEMAP_API_URL=https://api.vishnuanilkumar.in/api/v1 \
SITE_ORIGIN=https://vishnuanilkumar.in \
npm run build
```

The build runs `scripts/generate-sitemap.mjs` first. It fetches the deployed `/api/v1/site/` payload and writes `public/sitemap.xml` and `public/robots.txt`, so **deploy the API before building the site**. In CI/production (`CI=true`, `NODE_ENV=production`, `NETLIFY`, `CF_PAGES` or `VERCEL`), an unreachable API aborts the build with a non-zero exit instead of keeping a stale sitemap or pre-rendering stale pages. Only a local development build keeps the previous sitemap fallback.

Deploy `site/dist` to Cloudflare Pages or Netlify with:

- Build command: `npm ci && npm run build`
- Output directory: `dist`
- Environment: `VITE_API_URL`, `SITEMAP_API_URL`, `SITE_ORIGIN`
- SPA routing: `public/_redirects` serves `/projects/:slug/index.html` before the `/* /index.html 200` fallback. This keeps the pre-rendered project pages reachable on hosts that apply rewrites before directory indexes.
- Headers: `public/_headers` sets frame denial, nosniff, referrer policy, Permissions-Policy and HSTS. Cloudflare Pages and Netlify both honor this file; if the host does not, configure the same headers at the CDN.

The CSP is injected into `index.html` at build time by `site/vite.config.ts` and allows the site origin plus the API origin (`connect-src`, `img-src`). If the API moves to a new origin, rebuild the site.

### Automatic rebuilds after content changes

The public site is pre-rendered, so database edits only reach the deployed pages after a new site build. The API turns content changes into hosting build requests through a build hook:

1. Create a deploy/build hook in the site host:
   - **Netlify**: Site configuration → Build & deploy → Build hooks → Add build hook. Use the production branch.
   - **Cloudflare Pages**: Settings → Builds & deployments → Deploy hooks → Add deploy hook. Use the production branch.
   - **Vercel**: Settings → Git → Deploy Hooks. Use the production branch.
2. Put the hook URL in the API host's secret store as `SITE_REBUILD_HOOK_URL`, then redeploy/restart the API. Do not put it in `site/.env`, `admin/.env`, or any `VITE_*` variable; the admin bundle is public.
3. Leave the variable empty to disable the pipeline. The admin button shows that publishing is not configured, and content saves remain normal.

Once configured:

- A create, update or delete that can change the public output requests a rebuild **after the database commit**.
- Automatic requests are coalesced for **60 seconds** across all Gunicorn workers, so several rapid edits produce one build, not one per field. The dashboard **Publish site** button is an explicit manual trigger and bypasses that wait.
- Edits to hidden content do not trigger a build. Publishing or unpublishing a visible row does, as does editing a visible project, skill, screenshot of a visible project, or the always-published profile.
- The hook POST runs on a daemon thread; the admin request returns without waiting for the hosting provider.
- Success and failure are logged under the `content.rebuild` logger. The hook URL is never logged. A failed hook does not fail the admin save.
- The dashboard's **Publish site** button posts to the same debounced hook and shows **last rebuild requested at**. Changes appear only after the host finishes the build.

To test the pipeline locally, point `SITE_REBUILD_HOOK_URL` at any local HTTP receiver, save a visible project, and confirm one POST arrives. Saving a hidden project should produce none. The hook URL is optional; all backend tests run with it unset.

## 4. Admin panel

```bash
cd admin
npm ci
VITE_API_URL=https://api.vishnuanilkumar.in/api/v1 \
VITE_SITE_URL=https://vishnuanilkumar.in \
npm run build
```

Deploy `admin/dist` as a separate static project on `admin.vishnuanilkumar.in`, with the same SPA fallback (`public/_redirects`) and `public/_headers` (which also sets `X-Robots-Tag: noindex, nofollow`). The admin is a client-side app; its security boundary is the API, not the static host. Do not put any secret in `VITE_*` variables — they are compiled into the bundle.

## 5. DNS and TLS

1. Create `api` as a CNAME to the API host, and `admin` as a CNAME to the static host.
2. Point the apex and `www` at the public site; redirect `www` to the apex (or the reverse) so only one canonical origin is indexed.
3. Issue certificates for all four names. The API host terminates TLS and forwards `X-Forwarded-Proto: https`; `SECURE_PROXY_SSL_HEADER` and `NUM_PROXIES=1` rely on that.
4. Keep HSTS enabled only after every subdomain is HTTPS-ready. The header is set for one year with `includeSubDomains` and `preload`.

## 6. Deploy order

1. **API**: build, `migrate`, start the new release, confirm `/api/v1/health/`.
2. **Public site**: build (the sitemap step needs the live API), deploy the bundle.
3. **Admin**: build and deploy.
4. Run the post-deploy checks below.

## 7. Post-deploy checks

```bash
API=https://api.vishnuanilkumar.in/api/v1
SITE=https://vishnuanilkumar.in

curl -fsS "$API/health/"
curl -fsS "$API/site/" | head -c 300
curl -fsS "$API/sitemap.xml" | head -20
curl -fsS "$API/robots.txt"

# Security headers (expect HSTS, nosniff, DENY, CSP, no-store on API)
curl -sSI "$API/site/" | grep -iE 'strict-transport|x-content-type|x-frame|content-security|cache-control|referrer'
curl -sSI "$SITE/" | grep -iE 'strict-transport|x-content-type|x-frame|referrer'

# CORS: the site origin is allowed, an unknown origin is not
curl -sSI -H "Origin: $SITE" "$API/site/" | grep -i access-control-allow-origin
curl -sSI -H "Origin: https://evil.example" "$API/site/" | grep -i access-control-allow-origin || echo "blocked (expected)"

# Auth: a valid login returns tokens, no token is rejected
curl -sS -X POST "$API/auth/token/" \
  -H 'Content-Type: application/json' \
  -d '{"username":"...","password":"..."}' | head -c 200
curl -sS -o /dev/null -w '%{http_code}\n' "$API/admin/profile/"
```

Then in a browser:

- The home page renders content and projects, with no console errors and no failed requests.
- A project page loads directly (SPA fallback) and refreshes without a 404.
- The chatbot streams an answer, shows source chips, and still answers when the model is unavailable (extractive fallback).
- The contact form submits and the message appears in the admin panel.
- Admin login, one create/edit/delete, a file upload and sign-out all work.
- `/sitemap.xml` and `/robots.txt` on the site return the generated files.

## 8. Rollback

**Static site / admin** — redeploy the previous build artifact (Cloudflare Pages and Netlify both keep deployment history; “rollback” promotes the previous deployment). No database state is involved.

**API** — keep the previous release deployable (Render/Railway keep prior deploys; otherwise tag every release). To roll back:

1. Deploy the previous release/commit.
2. If the new release applied a migration, decide whether it is backward-compatible:
   - Additive migrations (new nullable column, new table) are safe; the old code ignores them.
   - Destructive or rewritten columns are not. Restore the pre-deploy database snapshot **first**, then deploy the previous release.
3. Never run `manage.py migrate zero` on production. It drops data and the down-migrations are not guaranteed to be reversible.
4. Re-run the post-deploy checks.

**Database** — restore the most recent verified dump into a new database, point `DATABASE_URL` at it, restart the API, and verify. Keep the old database until the restore is confirmed.

**Secrets** — rotating `SECRET_KEY` invalidates sessions and all outstanding JWTs (access tokens last 30 minutes; refresh tokens 7 days). Rotating `GROQ_API_KEY` or SMTP credentials only needs a redeploy.

## 9. Monitoring

- Uptime check on `GET /api/v1/health/` (it verifies the database) and on the site root.
- Collect stdout logs: `content.audit` (admin changes), `content.rebuild` (publish hook requests and failures), `content.security` (blocked logins), `chatbot` (provider failures), and Gunicorn access logs.
- Alert on sustained 5xx responses, database connection errors, disk usage (media and static files) and backup failures.
- Review the admin **Chat logs** for flagged requests and the dashboard checklist after content changes.
- Re-run `pip-audit` and `npm audit` on a schedule, not only at release time.

## 10. Go-live checklist

- [ ] Fresh `SECRET_KEY`; the historical key is not reused.
- [ ] `DEBUG=False`, `ALLOWED_HOSTS` and `NUM_PROXIES=1` set.
- [ ] PostgreSQL attached; migrations applied; backup schedule and one restore drill done.
- [ ] `collectstatic` run; admin CSS/JS load on the API host.
- [ ] `CORS_ALLOWED_ORIGINS` contains only the real site/admin origins.
- [ ] SMTP configured and a test contact message delivered.
- [ ] Groq key set (or the extractive fallback accepted deliberately).
- [ ] Site built against the deployed API; sitemap contains projects.
- [ ] `SITE_REBUILD_HOOK_URL` set on the API; dashboard **Publish site** triggers a build and the last-requested time updates.
- [ ] A visible content edit triggers exactly one build within the 60-second window; a hidden edit triggers none.
- [ ] Résumé and social image uploaded in Profile & SEO; project images added.
- [ ] Staff account created (not the superuser); password stored in a manager.
- [ ] Post-deploy checks pass, including headers and a chatbot answer.
- [ ] Uptime monitoring and log collection enabled.
