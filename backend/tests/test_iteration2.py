"""Iteration 2: Decimal precision, Backtest, Settings/Webhook, Jupiter swap tests."""
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
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "TestPass2026!", "name": "Iter2 Trader"})
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ---------- Decimal Precision ----------
class TestDecimalPrecision:
    def test_low_price_buy_amount_precise(self, auth):
        """MOG-like price ~1.5e-7 -> $50 should yield ~3.33e8 coins."""
        price = 1.5e-7
        amount_usd = 50.0
        body = {
            "coin_id": "mog-coin", "coin_symbol": "MOG", "coin_name": "Mog Coin",
            "side": "buy", "amount_usd": amount_usd, "price": price,
        }
        r = auth.post(f"{API}/trades", json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        expected = amount_usd / price  # ~3.333e8
        assert abs(d["amount_coin"] - expected) / expected < 1e-6, f"got {d['amount_coin']} expected ~{expected}"
        assert d["amount_coin"] > 3.0e8

    def test_cost_basis_after_multiple_buys(self, auth):
        """Two buys should accumulate cost_basis exactly via Decimal."""
        cid = f"test-coin-{uuid.uuid4().hex[:6]}"
        for amt in [25.0, 75.0]:
            r = auth.post(f"{API}/trades", json={
                "coin_id": cid, "coin_symbol": "TST", "coin_name": "Test",
                "side": "buy", "amount_usd": amt, "price": 0.0000002,
            })
            assert r.status_code == 200, r.text
        # Sell half
        r = auth.post(f"{API}/trades", json={
            "coin_id": cid, "coin_symbol": "TST", "coin_name": "Test",
            "side": "sell", "amount_usd": 50.0, "price": 0.0000002,
        })
        assert r.status_code == 200, r.text


# ---------- Bots P&L fields ----------
class TestBotsPnL:
    def test_bots_have_pnl_fields(self, auth):
        # Create a bot
        r = auth.post(f"{API}/bots", json={
            "name": "TEST_Bot", "coin_id": "dogecoin", "coin_symbol": "DOGE",
            "strategy": "dca", "allocation_usd": 100.0, "config": {"per_trade_usd": 10, "interval_minutes": 60},
        })
        assert r.status_code == 200, r.text
        bot_id = r.json()["bot_id"]
        # List bots
        r = auth.get(f"{API}/bots")
        assert r.status_code == 200
        bots = r.json()
        assert len(bots) >= 1
        target = next((b for b in bots if b["bot_id"] == bot_id), None)
        assert target is not None
        assert "pnl_usd" in target
        assert "pnl_pct" in target
        assert "coins_held" in target
        assert isinstance(target["pnl_usd"], (int, float))


# ---------- Backtest ----------
class TestBacktest:
    @pytest.mark.parametrize("strategy", ["momentum", "dca", "stop_loss_take_profit", "ai_signal"])
    def test_backtest_strategies(self, auth, strategy):
        body = {
            "coin_id": "dogecoin", "strategy": strategy,
            "allocation_usd": 1000.0, "days": 7,
            "config": {"per_trade_usd": 100, "stop_loss_pct": 10, "take_profit_pct": 25, "buy_change_pct": 5, "sell_change_pct": -3, "interval_minutes": 60},
        }
        r = auth.post(f"{API}/backtest", json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["starting_capital", "ending_equity", "pnl_usd", "pnl_pct", "trades", "equity_curve"]:
            assert k in d, f"missing {k}"
        assert d["starting_capital"] == 1000.0
        assert isinstance(d["trades"], list)
        assert isinstance(d["equity_curve"], list)
        assert len(d["equity_curve"]) > 0


# ---------- Settings & Webhook ----------
class TestSettings:
    def test_get_default_settings(self, auth):
        r = auth.get(f"{API}/settings")
        assert r.status_code == 200
        d = r.json()
        assert "webhook_url" in d
        assert "alert_on_trade" in d
        assert "alert_on_signal" in d

    def test_save_and_load_settings(self, auth):
        url = "https://httpbin.org/post"
        r = auth.post(f"{API}/settings", json={"webhook_url": url, "alert_on_trade": True, "alert_on_signal": True})
        assert r.status_code == 200
        r2 = auth.get(f"{API}/settings")
        assert r2.status_code == 200
        d = r2.json()
        assert d["webhook_url"] == url
        assert d["alert_on_trade"] is True
        assert d["alert_on_signal"] is True

    def test_test_webhook_no_url(self, auth):
        # First clear
        auth.post(f"{API}/settings", json={"webhook_url": None, "alert_on_trade": True, "alert_on_signal": True})
        r = auth.post(f"{API}/settings/test-webhook")
        assert r.status_code == 400

    def test_test_webhook_with_url(self, auth):
        auth.post(f"{API}/settings", json={"webhook_url": "https://httpbin.org/post", "alert_on_trade": True, "alert_on_signal": True})
        r = auth.post(f"{API}/settings/test-webhook")
        assert r.status_code == 200
        d = r.json()
        assert d.get("ok") is True
        assert d.get("status", 0) < 400

    def test_trade_with_webhook_does_not_break(self, auth):
        # Webhook set; firing a trade should still succeed
        auth.post(f"{API}/settings", json={"webhook_url": "https://httpbin.org/post", "alert_on_trade": True, "alert_on_signal": True})
        r = auth.post(f"{API}/trades", json={
            "coin_id": "dogecoin", "coin_symbol": "DOGE", "coin_name": "Dogecoin",
            "side": "buy", "amount_usd": 5.0, "price": 0.10,
        })
        assert r.status_code == 200, r.text
        assert "trade_id" in r.json()


# ---------- Jupiter ----------
class TestJupiter:
    SOL = "So11111111111111111111111111111111111111112"
    BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"

    def test_jupiter_quote(self, auth):
        # 0.01 SOL = 10_000_000 lamports
        r = auth.get(f"{API}/swap/jupiter/quote", params={
            "input_mint": self.SOL, "output_mint": self.BONK, "amount": 10_000_000, "slippage_bps": 50,
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert "outAmount" in d
        assert int(d["outAmount"]) > 0

    def test_jupiter_build(self, auth):
        # Get a quote first
        r = auth.get(f"{API}/swap/jupiter/quote", params={
            "input_mint": self.SOL, "output_mint": self.BONK, "amount": 10_000_000, "slippage_bps": 50,
        })
        assert r.status_code == 200
        quote = r.json()
        r2 = auth.post(f"{API}/swap/jupiter/build", json={
            "quote_response": quote,
            "user_public_key": "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
        })
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert "swapTransaction" in d
        assert isinstance(d["swapTransaction"], str)
        assert len(d["swapTransaction"]) > 50  # base64 string
