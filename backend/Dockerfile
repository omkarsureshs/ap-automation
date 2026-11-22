# NOT BUILT OR RUN on the dev machine (no Docker available there). See docs/DEPLOYMENT.md.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# Tesseract = OCR engine, poppler-utils = PDF -> image (used by pdf2image)
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Needs STATIC_ROOT in settings; tolerated if absent so the image still builds.
RUN python manage.py collectstatic --noinput || echo "collectstatic skipped (STATIC_ROOT not configured)"

# Non-root user; media/ is where uploaded invoices land (mount a volume here).
RUN useradd --create-home app && mkdir -p /app/media /app/staticfiles && chown -R app:app /app
USER app

ENV PORT=8000
EXPOSE 8000

# Migrate on every start (idempotent), then serve. OCR is synchronous, so keep a long timeout.
# --users-only: a deployed instance should start genuinely empty (no synthetic
# demo-001..012 invoices), not pre-populated -- just the 4 login accounts and
# the one approval rule needed for the workflow to function at all.
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py seed_demo --users-only && exec gunicorn apconfig.wsgi:application --bind 0.0.0.0:${PORT} --workers ${WEB_CONCURRENCY:-3} --timeout 120"]
