"""Comprehensive backend tests for Meme Coin Auto Trading App."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://coin-autopilot-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth(session):
    """Register a unique user, return (token, user)."""
    email = f"TEST_{uuid.uuid4().hex[:10]}@memetrade.io"
    payload = {"email": email, "password": "TestPass2026!", "name": "Test Trader"}
    r = session.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    return {"token": data["token"], "user": data["user"], "email": email, "password": "TestPass2026!"}


@pytest.fixture(scope="session")
def auth_headers(auth):
    return {"Authorization": f"Bearer {auth['token']}", "Content-Type": "application/json"}


# ---------- Health ----------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        d = r.json()
        assert d.get("status") == "live"


# ---------- Auth ----------
class TestAuth:
    def test_login_existing(self, session, auth):
        r = session.post(f"{API}/auth/login", json={"email": auth["email"], "password": auth["password"]})
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["email"] == auth["email"]
        assert isinstance(d["token"], str) and len(d["token"]) > 20

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login", json={"email": "nope@nowhere.io", "password": "wrong"})
        assert r.status_code == 401

    def test_register_duplicate(self, session, auth):
        r = session.post(f"{API}/auth/register", json={"email": auth["email"], "password": "x", "name": "x"})
        assert r.status_code == 400

    def test_me_with_bearer(self, session, auth_headers, auth):
        r = session.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == auth["email"]

    def test_me_without_token(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------- Coins ----------
class TestCoins:
    def test_trending(self, session):
        r = session.get(f"{API}/coins/trending")
        assert r.status_code == 200
        coins = r.json()
        assert isinstance(coins, list) and len(coins) == 10
        # at least some non-zero prices
        nonzero = [c for c in coins if (c.get("price") or 0) > 0]
        assert len(nonzero) >= 5, f"expected >=5 non-zero prices got {len(nonzero)}"
        symbols = {c["symbol"] for c in coins}
        assert "DOGE" in symbols and "SHIB" in symbols

    def test_coin_detail(self, session):
        r = session.get(f"{API}/coins/dogecoin")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == "dogecoin"
        assert d["symbol"] == "DOGE"

    def test_coin_chart(self, session):
        r = session.get(f"{API}/coins/dogecoin/chart?days=1")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("prices"), list)
        assert len(d["prices"]) > 0
        assert "t" in d["prices"][0] and "p" in d["prices"][0]

    def test_dex_trending(self, session):
        r = session.get(f"{API}/coins/dex/trending")
        assert r.status_code == 200
        d = r.json()
        assert "pairs" in d
        assert isinstance(d["pairs"], list)


# ---------- Trades & Portfolio ----------
class TestTrades:
    def test_initial_portfolio(self, session, auth_headers):
        r = session.get(f"{API}/portfolio", headers=auth_headers)
        assert r.status_code == 200
        p = r.json()
        assert p["balance_usd"] == 10000.0
        assert p["positions"] == []

    def test_buy_then_portfolio(self, session, auth_headers):
        # get current price
        coin = session.get(f"{API}/coins/dogecoin").json()
        price = coin.get("price") or 0.1
        body = {
            "coin_id": "dogecoin", "coin_symbol": "DOGE", "coin_name": "Dogecoin",
            "side": "buy", "amount_usd": 500.0, "price": price,
        }
        r = session.post(f"{API}/trades", headers=auth_headers, json=body)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["side"] == "buy" and t["amount_usd"] == 500.0
        assert "trade_id" in t

        # portfolio reflects
        p = session.get(f"{API}/portfolio", headers=auth_headers).json()
        assert abs(p["balance_usd"] - 9500.0) < 0.01
        assert len(p["positions"]) == 1
        assert p["positions"][0]["coin_id"] == "dogecoin"

    def test_sell_insufficient(self, session, auth_headers):
        body = {
            "coin_id": "shiba-inu", "coin_symbol": "SHIB", "coin_name": "Shiba Inu",
            "side": "sell", "amount_usd": 100.0, "price": 0.0001,
        }
        r = session.post(f"{API}/trades", headers=auth_headers, json=body)
        assert r.status_code == 400

    def test_buy_insufficient_balance(self, session, auth_headers):
        body = {
            "coin_id": "dogecoin", "coin_symbol": "DOGE", "coin_name": "Dogecoin",
            "side": "buy", "amount_usd": 9999999.0, "price": 0.1,
        }
        r = session.post(f"{API}/trades", headers=auth_headers, json=body)
        assert r.status_code == 400

    def test_sell_partial(self, session, auth_headers):
        # sell a small portion of dogecoin position
        coin = session.get(f"{API}/coins/dogecoin").json()
        price = coin.get("price") or 0.1
        body = {
            "coin_id": "dogecoin", "coin_symbol": "DOGE", "coin_name": "Dogecoin",
            "side": "sell", "amount_usd": 100.0, "price": price,
        }
        r = session.post(f"{API}/trades", headers=auth_headers, json=body)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["side"] == "sell"

    def test_list_trades(self, session, auth_headers):
        r = session.get(f"{API}/trades", headers=auth_headers)
        assert r.status_code == 200
        trades = r.json()
        assert isinstance(trades, list) and len(trades) >= 2  # buy + partial sell


# ---------- Bots ----------
class TestBots:
    @pytest.fixture(scope="class")
    def created_bots(self):
        return {}

    @pytest.mark.parametrize("strategy", ["momentum", "dca", "stop_loss_take_profit", "ai_signal"])
    def test_create_bot(self, session, auth_headers, strategy, created_bots):
        body = {
            "name": f"TEST_bot_{strategy}", "coin_id": "dogecoin", "coin_symbol": "DOGE",
            "strategy": strategy, "allocation_usd": 200.0,
            "config": {"per_trade_usd": 10},
        }
        r = session.post(f"{API}/bots", headers=auth_headers, json=body)
        assert r.status_code == 200, r.text
        bot = r.json()
        assert bot["strategy"] == strategy and bot["active"] is True
        assert "bot_id" in bot
        created_bots[strategy] = bot["bot_id"]

    def test_list_bots(self, session, auth_headers, created_bots):
        r = session.get(f"{API}/bots", headers=auth_headers)
        assert r.status_code == 200
        bots = r.json()
        assert len(bots) >= 4

    def test_toggle_bot(self, session, auth_headers, created_bots):
        bot_id = created_bots.get("momentum")
        if not bot_id:
            pytest.skip("no momentum bot")
        r = session.patch(f"{API}/bots/{bot_id}/toggle", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["active"] is False

    def test_delete_bot(self, session, auth_headers, created_bots):
        for strategy, bot_id in list(created_bots.items()):
            r = session.delete(f"{API}/bots/{bot_id}", headers=auth_headers)
            assert r.status_code == 200

    def test_delete_missing(self, session, auth_headers):
        r = session.delete(f"{API}/bots/bot_nonexistent", headers=auth_headers)
        assert r.status_code == 404


# ---------- AI Signals ----------
class TestAI:
    def test_generate_signal(self, session, auth_headers):
        # AI calls can be slow, allow up to 60s
        r = session.get(f"{API}/ai/signal/dogecoin", headers=auth_headers, timeout=90)
        assert r.status_code == 200, r.text
        sig = r.json()
        assert sig.get("signal") in ("BUY", "SELL", "HOLD")
        assert isinstance(sig.get("confidence"), int)
        assert sig.get("risk") in ("LOW", "MED", "HIGH")
        assert sig["coin_id"] == "dogecoin"

    def test_list_signals(self, session, auth_headers):
        r = session.get(f"{API}/ai/signals", headers=auth_headers)
        assert r.status_code == 200
        sigs = r.json()
        assert isinstance(sigs, list) and len(sigs) >= 1


# ---------- Wallets ----------
class TestWallets:
    @pytest.fixture(scope="class")
    def wallet_state(self):
        return {}

    def test_add_wallet(self, session, auth_headers, wallet_state):
        body = {"address": "TEST_5xK2Q1abcXYZ", "chain": "solana", "label": "Test Sol"}
        r = session.post(f"{API}/wallets", headers=auth_headers, json=body)
        assert r.status_code == 200
        w = r.json()
        assert w["chain"] == "solana"
        assert "wallet_id" in w
        wallet_state["id"] = w["wallet_id"]

    def test_list_wallets(self, session, auth_headers):
        r = session.get(f"{API}/wallets", headers=auth_headers)
        assert r.status_code == 200
        ws = r.json()
        assert isinstance(ws, list) and len(ws) >= 1

    def test_delete_wallet(self, session, auth_headers, wallet_state):
        wid = wallet_state.get("id")
        if not wid:
            pytest.skip("no wallet")
        r = session.delete(f"{API}/wallets/{wid}", headers=auth_headers)
        assert r.status_code == 200
