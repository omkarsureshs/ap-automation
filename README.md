# AP Automation

Accounts Payable automation system — OCR invoice capture, validation, PO/GRN
matching, role-based approval workflow, mock payment processing, dashboards
and reports. Built with Django + DRF + PostgreSQL (backend) and React +
TypeScript + Tailwind + shadcn/ui (frontend).

Design rationale and decisions: see `docs/superpowers/specs/2026-11-18-ap-automation-design.md`
and `docs/DECISIONS.md`.

## Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 16+ (via `docker-compose.yml`, or a native install)
- Tesseract OCR binary (for invoice OCR — `tesseract --version` should work)

## Backend setup

```bash
docker-compose up -d          # starts Postgres on localhost:5432
cd backend
python -m venv .venv
.venv/Scripts/activate         # .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Environment variables (all optional, default to the `docker-compose.yml` values):
`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`,
`POSTGRES_PORT`, `TESSERACT_CMD` (path to the `tesseract` binary if it isn't
on `PATH`).

Run tests: `pytest` from `backend/`.

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Dev server runs at `http://localhost:5173` and talks to the backend API at
`http://localhost:8000`.
