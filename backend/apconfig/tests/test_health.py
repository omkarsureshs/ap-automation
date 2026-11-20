import pytest
from django.db import connection
from rest_framework.throttling import ScopedRateThrottle


@pytest.mark.django_db
def test_health_check(client):
    resp = client.get("/api/health/")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "database": "ok"}


@pytest.mark.django_db
def test_health_check_degraded_when_db_down(client, monkeypatch):
    def boom(*a, **k):
        raise Exception("db down")

    monkeypatch.setattr(connection, "cursor", boom)
    resp = client.get("/api/health/")
    assert resp.status_code == 503
    assert resp.json() == {"status": "degraded", "database": "unavailable"}


@pytest.mark.django_db
def test_docs_and_schema_public(client):
    assert client.get("/api/schema/").status_code == 200
    assert client.get("/api/docs/").status_code == 200


@pytest.mark.django_db
def test_login_is_throttled(client, monkeypatch):
    from django.core.cache import cache

    cache.clear()
    monkeypatch.setitem(ScopedRateThrottle.THROTTLE_RATES, "login", "2/min")
    codes = [client.post("/api/auth/login/", {"email": "a@b.c", "password": "x"}).status_code for _ in range(3)]
    assert codes[-1] == 429
    assert 429 not in codes[:2]
    cache.clear()
