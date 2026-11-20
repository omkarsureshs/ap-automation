# Deployment Runbook

> **Not verified on this machine.** Docker was unavailable on the development machine, so `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `docker-compose.prod.yml` and `.github/workflows/ci.yml` were written but never built, run or tested. Expect to fix small things on first build. Everything below is a plan, not a report of something that worked.

## Fix these before deploying (code-level gaps found while writing this)

1. **Static files.** `settings.py` has no `STATIC_ROOT` and no WhiteNoise middleware, though `whitenoise` is in requirements. Without them `collectstatic` fails (the Dockerfile tolerates that) and the Django admin and API docs pages will have no CSS in production. Add `STATIC_ROOT = BASE_DIR / "staticfiles"` and `whitenoise.middleware.WhiteNoiseMiddleware` right after `SecurityMiddleware`.
2. **Media files are not served by Django.** `urls.py` does not route `/media/`. The nginx config proxies `/media/` to Django, so either add a media route or serve the volume directly from nginx.
3. **`CSRF_TRUSTED_ORIGINS` is not read by settings** (only needed for Django admin logins over HTTPS). Add it before using the admin behind a domain.
4. **Django admin is not mounted** in `apconfig/urls.py`. Approval rules are model data; unless `seed_demo` creates them you need some way to edit them (mount `admin/`, or use `manage.py shell`).
5. **Insecure defaults.** Secret key, encryption key and `DJANGO_DEBUG=True` default to development values. Always set all three explicitly.
6. **Escalation needs a scheduler** (cron) calling `manage.py escalate_pending_approvals`; nothing runs it automatically.

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
