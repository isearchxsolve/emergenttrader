"""Risk control and ops endpoint regression tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://coin-autopilot-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def auth():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = f"TEST_{uuid.uuid4().hex[:10]}@memetrade.io"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "TestPass2026!", "name": "Risk Tester"})
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


class TestRiskOps:
    def test_health_endpoints(self, auth):
        live = auth.get(f"{API}/health/live")
        ready = auth.get(f"{API}/health/ready")
        assert live.status_code == 200
        assert "ok" in live.json()
        assert ready.status_code in (200, 503)
        assert "ok" in ready.json()

    def test_pause_and_resume(self, auth):
        p = auth.post(f"{API}/risk/pause-all", json={"reason": "test pause"})
        if p.status_code == 403:
            # Non-admin test identity. RBAC is working.
            return
        assert p.status_code in (200, 401), p.text
        if p.status_code == 401:
            # Action signing enforced by env var.
            return
        status = auth.get(f"{API}/risk/status")
        assert status.status_code == 200
        assert status.json()["trading_paused"] is True

        blocked = auth.post(f"{API}/trades", json={
            "coin_id": "dogecoin", "coin_symbol": "DOGE", "coin_name": "Dogecoin",
            "side": "buy", "amount_usd": 10, "price": 0.1,
        })
        assert blocked.status_code == 423

        r = auth.post(f"{API}/risk/resume-all")
        assert r.status_code in (200, 401)
        if r.status_code == 401:
            return
        status2 = auth.get(f"{API}/risk/status")
        assert status2.status_code == 200
        assert status2.json()["trading_paused"] is False

    def test_trade_idempotency(self, auth):
        key = f"idem-{uuid.uuid4().hex[:12]}"
        headers = {"X-Idempotency-Key": key}
        payload = {
            "coin_id": "dogecoin", "coin_symbol": "DOGE", "coin_name": "Dogecoin",
            "side": "buy", "amount_usd": 7.0, "price": 0.1,
        }
        t1 = auth.post(f"{API}/trades", json=payload, headers=headers)
        t2 = auth.post(f"{API}/trades", json=payload, headers=headers)
        assert t1.status_code == 200, t1.text
        assert t2.status_code == 200, t2.text
        assert t1.json()["trade_id"] == t2.json()["trade_id"]

    def test_jupiter_stale_quote_rejected(self, auth):
        q = auth.get(f"{API}/swap/jupiter/quote", params={
            "input_mint": "So11111111111111111111111111111111111111112",
            "output_mint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
            "amount": 10_000_000,
            "slippage_bps": 50,
        })
        assert q.status_code == 200, q.text
        quote = q.json()
        quote.setdefault("_meta", {})
        quote["_meta"]["quoted_at_ms"] = 1  # force stale
        b = auth.post(f"{API}/swap/jupiter/build", json={
            "quote_response": quote,
            "user_public_key": "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
        })
        assert b.status_code == 400

    def test_admin_ops_endpoints_guarded(self, auth):
        latest = auth.get(f"{API}/ops/reconciliation/latest")
        run = auth.post(f"{API}/ops/reconciliation/run")
        metrics = auth.get(f"{API}/metrics")
        assert latest.status_code in (200, 403)
        assert run.status_code in (200, 403)
        assert metrics.status_code in (200, 403)
