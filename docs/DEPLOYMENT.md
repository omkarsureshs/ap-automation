# Deployment Runbook

> **Not verified on this machine.** Docker was unavailable on the development machine, so `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `docker-compose.prod.yml` and `.github/workflows/ci.yml` were written but never built, run or tested. Expect to fix small things on first build. Everything below is a plan, not a report of something that worked.

## Fix these before deploying (status as of the last review pass)

Items 1, 3 and 4 below were real gaps when this doc was first written; they are now fixed in code. The rest are still open.

1. ~~Static files~~ — **fixed.** `STATIC_ROOT` and `whitenoise.middleware.WhiteNoiseMiddleware` are both in `settings.py` now.
2. ~~Media files only served in `DEBUG` mode~~ — **fixed for Path B (docker-compose).** `urls.py` only routes `/media/` through Django itself `if settings.DEBUG`, so nginx can no longer proxy to Django for that path in production. Instead, `docker-compose.prod.yml` mounts the same `media_data` named volume the backend writes into onto the frontend container, and `nginx.conf`'s `/media/` location serves those files directly (`alias`, read-only). **Path A (Render, single service) still needs real object storage** — there's no second container to share a Docker volume with, and Render's own disk doesn't survive a redeploy either way. Switch to S3-compatible storage via `django-storages` before using Path A for anything beyond a demo.
3. ~~`CSRF_TRUSTED_ORIGINS`~~ — **fixed.** Read from the `CSRF_TRUSTED_ORIGINS` env var (comma-separated).
4. ~~Django admin not mounted~~ — **fixed.** `/admin/` is mounted in `apconfig/urls.py`. **New gap this uncovered:** `frontend/nginx.conf` only proxies `/api/` and `/media/` to the backend — `/admin/` and `/static/` (WhiteNoise's own static files, including the admin's CSS) fall through to the SPA's `index.html` and never reach Django. Add `location /admin/ { proxy_pass http://backend:8000; }` and `location /static/ { proxy_pass http://backend:8000; }` (same proxy settings as the existing `/api/` block) before relying on the admin in the docker-compose path.
5. **Insecure defaults, now enforced for the secret key and the encryption key.** `DJANGO_SECRET_KEY` and `FIELD_ENCRYPTION_KEY` both raise `ImproperlyConfigured` at startup if left at their development defaults while `DJANGO_DEBUG` is not `True` — you cannot accidentally deploy with either one unset. `DJANGO_DEBUG` itself has no such guard: it simply defaults to `True`, so you must explicitly set `DJANGO_DEBUG=False` yourself; nothing will stop you from forgetting.
6. **Escalation needs a scheduler** (cron) calling `manage.py escalate_pending_approvals`; nothing runs it automatically.
7. **Login throttling is per-process and trusts exactly one proxy hop.** `REST_FRAMEWORK["NUM_PROXIES"]` is set to `1` to match the nginx topology below — if you put a CDN or a second proxy in front of nginx, increase it, or the throttle becomes bypassable by spoofing `X-Forwarded-For` again. Separately, the rate limit uses Django's default `LocMemCache`, which is **not shared across gunicorn workers** — with `N` workers the real limit is `N ×` the configured rate. Point `CACHES` at a shared backend (Redis, or at minimum Django's database cache via `createcachetable`) before running more than one worker in production.

## Environment variables

| Variable | Purpose | How to get a value |
|---|---|---|
| `DJANGO_SECRET_KEY` | Django signing key | `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `FIELD_ENCRYPTION_KEY` | Encrypts vendor bank details | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `DJANGO_DEBUG` | Must be `False` | literal |
| `DJANGO_ALLOWED_HOSTS` | Comma list of your hostnames | e.g. `ap.example.com` |
| `CORS_ALLOWED_ORIGINS` | Frontend origin(s), with scheme | e.g. `https://ap.example.com` (not needed if same origin) |
| `CSRF_TRUSTED_ORIGINS` | See gap 3 | e.g. `https://ap.example.com` |
| `POSTGRES_DB/USER/PASSWORD/HOST/PORT` | Database | from the managed Postgres page |
| `EMAIL_HOST/PORT/HOST_USER/HOST_PASSWORD/USE_TLS`, `DEFAULT_FROM_EMAIL` | Real email. If `EMAIL_HOST` is unset, emails print to the log | your SMTP provider |
| `BANKING_GATEWAY` | `mock` (only option) | literal |
| `TESSERACT_CMD`, `POPPLER_PATH` | Leave empty in Docker (binaries on PATH) | |
| `PORT` | Port gunicorn binds (Render sets it) | |
| `VITE_API_BASE` (frontend build arg) | API base URL. Empty means same origin | |

**Keep `FIELD_ENCRYPTION_KEY` safe.** If it is lost or changed, existing vendor bank details can no longer be decrypted.

## Path A: Render

DECISIONS.md #8 describes one Render web service. As written, the backend image serves only the API; the React app is built by `frontend/Dockerfile` with nginx. The simplest working Render layout is therefore two services, which differs slightly from decision #8. For a true single service, use Path B on a VPS (nginx in front of both).

1. Create a **PostgreSQL** instance on Render. Note the internal host, database, user and password.
2. Create a **Web Service** from this repo: environment Docker, root directory `backend`, Dockerfile `backend/Dockerfile`. Set the env vars above. Set **Health Check Path** to `/api/health/`.
3. The container runs `migrate` on every start, then gunicorn on `$PORT` (3 workers, 120 s timeout because OCR is synchronous). Tesseract and Poppler are installed with apt inside the image.
4. Create the first admin: open the service **Shell** and run `python manage.py createsuperuser` (role defaults to `ap_admin`). For a demo, also run `python manage.py seed_demo`.
5. Deploy the frontend: either a second Render service from `frontend/Dockerfile` (set build arg `VITE_API_BASE` to the backend's public URL, and add that frontend origin to `CORS_ALLOWED_ORIGINS`), or a Render Static Site with build command `npm ci && npm run build`, publish directory `dist`, and a rewrite of `/*` to `/index.html`.
6. **Uploaded files warning.** Invoices are saved to `media/` on the container's local disk. On Render that disk is wiped on every deploy or restart, so files (and their links in the database) are lost. Fix: attach a Render persistent disk mounted at `/app/media` (paid plans), or move uploads to object storage (S3 or compatible, using `django-storages`). The latter needs a code change.
7. Schedule escalation: a Render Cron Job running `python manage.py escalate_pending_approvals` hourly.

## Path B: single VPS with docker-compose

```bash
git clone <repo> && cd ap-automation
cp .env.example .env            # edit every value; generate keys as above
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

Services: `postgres` (volume `postgres_data`), `backend` (gunicorn, volume `media_data` mounted at `/app/media`, so uploads survive redeploys), `frontend` (nginx on port 80: serves the built SPA, falls back to `index.html`, proxies `/api/` and `/media/` to `backend:8000`).

**TLS:** put Caddy in front (simplest: a Caddyfile with your domain and `reverse_proxy localhost:80`, which fetches certificates automatically), or run certbot with nginx. Then set `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` to the `https://` domain.

**Escalation cron** on the host: `0 * * * * cd /path && docker compose -f docker-compose.prod.yml exec -T backend python manage.py escalate_pending_approvals`.

## Post-deploy smoke test

1. `curl -i https://YOUR_HOST/api/health/` returns 200 and `{"status": "ok"}`.
2. Open the site; the login page renders; `/does-not-exist` shows the 404 page.
3. Log in as the admin you created.
4. Create a vendor; confirm the bank number is masked when logged in as a non-admin.
5. Upload a sample invoice; confirm OCR returns fields (proves Tesseract/Poppler are in the image).
6. Restart the backend container and confirm the uploaded file still opens (proves the media volume).
7. Request payment on an approved invoice; confirm a `MOCK-` reference.
8. Check logs for errors.

## Rollback

- Docker: `git checkout <previous tag>` then rebuild and `up -d`. Migrations are forward-only; before deploying a release with migrations, take a backup: `docker compose -f docker-compose.prod.yml exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql`.
- Render: redeploy the previous successful deploy from the dashboard. Restore the database from a Render backup if the release included migrations.

## What to rotate

If any secret was ever committed, pasted in a chat or used from the dev defaults, rotate it: `DJANGO_SECRET_KEY` (logs everyone out), database password, SMTP password. Rotating `FIELD_ENCRYPTION_KEY` requires decrypting with the old key and re-encrypting with the new one first; do not just swap it. The development key in `settings.py` is public in the repo history and must never be used in production.
