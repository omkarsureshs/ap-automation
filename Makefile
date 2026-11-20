# Dev helpers. On Windows run these from Git Bash or WSL (needs `make`).
# Assumes backend/.venv exists; override with: make test PY=path/to/python
PY ?= $(CURDIR)/backend/.venv/Scripts/python
.PHONY: backend-run frontend-run test seed lint build

backend-run:
	cd backend && $(PY) manage.py runserver

frontend-run:
	cd frontend && npm run dev

test:
	cd backend && $(PY) -m pytest

seed:
	cd backend && $(PY) manage.py seed_demo

lint:
	cd frontend && npm run lint

build:
	cd frontend && npm run build
