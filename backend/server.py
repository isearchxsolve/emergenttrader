"""Meme Coin Auto Trading App - Backend"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Cookie, Header
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import uuid
import jwt
import bcrypt
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
from contextlib import asynccontextmanager
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
JWT_SECRET = os.environ['JWT_SECRET']
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    auth_provider: str = "jwt"
    paper_balance_usd: float = 10000.0

class TradeIn(BaseModel):
    coin_id: str
    coin_symbol: str
    coin_name: str
    side: Literal['buy', 'sell']
    amount_usd: float
    price: float

class BotIn(BaseModel):
    name: str
    coin_id: str
    coin_symbol: str
    strategy: Literal['momentum', 'dca', 'stop_loss_take_profit', 'ai_signal']
    allocation_usd: float
    config: dict = {}  # strategy-specific params

class WalletIn(BaseModel):
    address: str
    chain: Literal['solana', 'ethereum']
    label: Optional[str] = None

# ---------- Auth Helpers ----------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())

def create_jwt(user_id: str) -> str:
    payload = {"user_id": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_user(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
) -> User:
    """Dual auth: JWT (Bearer) OR Emergent session cookie/header."""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    if not token:
        token = session_token
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Try JWT first
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if user_doc:
            return User(**user_doc)
    except jwt.PyJWTError:
        pass

    # Try Emergent session
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = sess["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user_doc = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)

# ---------- Lifespan ----------
@asynccontextmanager
async def lifespan(app: FastAPI):
    bot_task = asyncio.create_task(bot_engine_loop())
    yield
    bot_task.cancel()
    client.close()

app = FastAPI(lifespan=lifespan)
api = APIRouter(prefix="/api")

# ---------- Auth Routes ----------
@api.post("/auth/register")
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": body.email,
        "name": body.name,
        "picture": None,
        "auth_provider": "jwt",
        "password_hash": hash_password(body.password),
        "paper_balance_usd": 10000.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = create_jwt(user_id)
    user_doc.pop("_id", None)
    user_doc.pop("password_hash", None)
    return {"token": token, "user": user_doc}

@api.post("/auth/login")
async def login(body: LoginIn):
    user_doc = await db.users.find_one({"email": body.email}, {"_id": 0})
    if not user_doc or not user_doc.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(body.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_jwt(user_doc["user_id"])
    user_doc.pop("password_hash", None)
    return {"token": token, "user": user_doc}

@api.post("/auth/google/session")
async def google_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")
    async with httpx.AsyncClient() as http:
        r = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
            timeout=15.0,
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = r.json()
    email = data["email"]
    name = data.get("name") or email
    picture = data.get("picture")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "auth_provider": "google",
            "paper_balance_usd": 10000.0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    response.set_cookie(
        "session_token", session_token,
        httponly=True, secure=True, samesite="none", path="/",
        max_age=7 * 24 * 60 * 60,
    )
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    user_doc.pop("password_hash", None)
    return {"user": user_doc, "session_token": session_token}

@api.get("/auth/me", response_model=User)
async def me(current: User = Depends(get_current_user)):
    return current

@api.post("/auth/logout")
async def logout(response: Response, session_token: Optional[str] = Cookie(None)):
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

# ---------- Coin Data ----------
TRENDING_COINS = [
    {"id": "dogecoin", "paprika": "doge-dogecoin", "symbol": "DOGE", "name": "Dogecoin", "chain": "multi"},
    {"id": "shiba-inu", "paprika": "shib-shiba-inu", "symbol": "SHIB", "name": "Shiba Inu", "chain": "ethereum"},
    {"id": "pepe", "paprika": "pepe-pepe", "symbol": "PEPE", "name": "Pepe", "chain": "ethereum"},
    {"id": "bonk", "paprika": "bonk1-bonk", "symbol": "BONK", "name": "Bonk", "chain": "solana"},
    {"id": "dogwifcoin", "paprika": "wif-dogwifhat", "symbol": "WIF", "name": "dogwifhat", "chain": "solana"},
    {"id": "floki", "paprika": "floki-floki-inu", "symbol": "FLOKI", "name": "Floki", "chain": "ethereum"},
    {"id": "book-of-meme", "paprika": "bome-book-of-meme", "symbol": "BOME", "name": "Book of Meme", "chain": "solana"},
    {"id": "memecoin-2", "paprika": "meme-memecoin", "symbol": "MEME", "name": "Memecoin", "chain": "ethereum"},
    {"id": "popcat", "paprika": "popcat-popcat", "symbol": "POPCAT", "name": "Popcat", "chain": "solana"},
    {"id": "mog-coin", "paprika": "mog-mog-coin", "symbol": "MOG", "name": "Mog Coin", "chain": "ethereum"},
]
PAPRIKA_BY_GECKO = {c["id"]: c["paprika"] for c in TRENDING_COINS}

_price_cache: dict = {}
_price_cache_ts: dict = {}

async def _fetch_one_paprika(coin_id: str) -> Optional[dict]:
    pid = PAPRIKA_BY_GECKO.get(coin_id)
    if not pid:
        return None
    try:
        async with httpx.AsyncClient() as http:
            r = await http.get(f"https://api.coinpaprika.com/v1/tickers/{pid}", timeout=10.0)
        if r.status_code != 200:
            return None
        d = r.json()
        q = d.get("quotes", {}).get("USD", {})
        return {
            "price": q.get("price", 0) or 0,
            "change_24h": q.get("percent_change_24h", 0) or 0,
            "market_cap": q.get("market_cap", 0) or 0,
            "volume_24h": q.get("volume_24h", 0) or 0,
        }
    except Exception:
        return None

async def fetch_prices(coin_ids: List[str]) -> dict:
    """Fetch prices: CoinGecko first; fallback to CoinPaprika; cache 60s."""
    now = datetime.now(timezone.utc).timestamp()
    needs = [c for c in coin_ids if now - _price_cache_ts.get(c, 0) > 60]
    if needs:
        # Try CoinGecko bulk
        gecko_ok = False
        try:
            ids = ",".join(needs)
            url = f"https://api.coingecko.com/api/v3/simple/price?ids={ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true"
            async with httpx.AsyncClient() as http:
                r = await http.get(url, timeout=10.0)
            if r.status_code == 200:
                data = r.json()
                if data:
                    for cid, payload in data.items():
                        _price_cache[cid] = {
                            "price": payload.get("usd", 0) or 0,
                            "change_24h": payload.get("usd_24h_change", 0) or 0,
                            "market_cap": payload.get("usd_market_cap", 0) or 0,
                            "volume_24h": payload.get("usd_24h_vol", 0) or 0,
                        }
                        _price_cache_ts[cid] = now
                    gecko_ok = True
        except Exception as e:
            logger.warning(f"CoinGecko fetch failed: {e}")
        # Fallback to CoinPaprika per-coin for missing
        missing = [c for c in needs if c not in _price_cache or _price_cache_ts.get(c, 0) < now - 60]
        if missing:
            results = await asyncio.gather(*[_fetch_one_paprika(c) for c in missing], return_exceptions=True)
            for cid, res in zip(missing, results):
                if isinstance(res, dict):
                    _price_cache[cid] = res
                    _price_cache_ts[cid] = now
    return {c: _price_cache.get(c, {"price": 0, "change_24h": 0, "market_cap": 0, "volume_24h": 0}) for c in coin_ids}

@api.get("/coins/trending")
async def trending():
    ids = [c["id"] for c in TRENDING_COINS]
    prices = await fetch_prices(ids)
    out = []
    for c in TRENDING_COINS:
        p = prices.get(c["id"], {})
        out.append({**c, **p})
    return out

@api.get("/coins/{coin_id}")
async def coin_detail(coin_id: str):
    prices = await fetch_prices([coin_id])
    base = next((c for c in TRENDING_COINS if c["id"] == coin_id), {"id": coin_id, "symbol": coin_id.upper(), "name": coin_id, "chain": "multi"})
    return {**base, **prices.get(coin_id, {})}

@api.get("/coins/{coin_id}/chart")
async def coin_chart(coin_id: str, days: int = 1):
    # Try CoinGecko first
    try:
        url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart?vs_currency=usd&days={days}"
        async with httpx.AsyncClient() as http:
            r = await http.get(url, timeout=10.0)
        if r.status_code == 200:
            data = r.json()
            prices = data.get("prices", [])
            if prices:
                return {"prices": [{"t": p[0], "p": p[1]} for p in prices]}
    except Exception as e:
        logger.warning(f"chart fetch (gecko) failed: {e}")
    # Fallback: CoinPaprika historical (1d intervals)
    pid = PAPRIKA_BY_GECKO.get(coin_id)
    if pid:
        try:
            from urllib.parse import quote
            start = (datetime.now(timezone.utc) - timedelta(days=max(1, days))).date().isoformat()
            interval = "1h" if days <= 7 else "1d"
            url = f"https://api.coinpaprika.com/v1/tickers/{pid}/historical?start={start}&interval={interval}"
            async with httpx.AsyncClient() as http:
                r = await http.get(url, timeout=12.0)
            if r.status_code == 200:
                data = r.json()
                pts = []
                for d in data:
                    ts = d.get("timestamp")
                    price = d.get("price")
                    if ts and price is not None:
                        # ts is ISO string
                        try:
                            ms = int(datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp() * 1000)
                        except Exception:
                            continue
                        pts.append({"t": ms, "p": float(price)})
                if pts:
                    return {"prices": pts}
        except Exception as e:
            logger.warning(f"chart fetch (paprika) failed: {e}")
    # Final fallback: synthetic walk seeded by current price
    cur = (await fetch_prices([coin_id])).get(coin_id, {"price": 0})
    base = cur.get("price", 0) or 1.0
    import random
    random.seed(hash(coin_id) & 0xFFFF)
    n = 96 if days <= 1 else (24 * days)
    pts = []
    p = base * 0.97
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    step = max(1, days) * 24 * 60 * 60 * 1000 // max(1, n)
    for i in range(n):
        p = max(0.0000001, p * (1 + (random.random() - 0.5) * 0.04))
        pts.append({"t": now_ms - (n - i) * step, "p": p})
    return {"prices": pts}

@api.get("/coins/dex/trending")
async def dex_trending():
    """DexScreener trending pairs."""
    try:
        async with httpx.AsyncClient() as http:
            r = await http.get(
                "https://api.dexscreener.com/latest/dex/search?q=memecoin",
                timeout=10.0,
            )
        if r.status_code != 200:
            return {"pairs": []}
        data = r.json()
        pairs = data.get("pairs", [])[:15]
        return {"pairs": [{
            "name": p.get("baseToken", {}).get("name", ""),
            "symbol": p.get("baseToken", {}).get("symbol", ""),
            "chain": p.get("chainId", ""),
            "price_usd": float(p.get("priceUsd", 0) or 0),
            "change_24h": p.get("priceChange", {}).get("h24", 0),
            "volume_24h": p.get("volume", {}).get("h24", 0),
            "liquidity": p.get("liquidity", {}).get("usd", 0),
            "url": p.get("url", ""),
        } for p in pairs]}
    except Exception as e:
        logger.warning(f"dexscreener fetch failed: {e}")
        return {"pairs": []}

# ---------- Portfolio & Trades ----------
@api.get("/portfolio")
async def get_portfolio(current: User = Depends(get_current_user)):
    positions_cursor = db.positions.find({"user_id": current.user_id}, {"_id": 0})
    positions = await positions_cursor.to_list(500)
    coin_ids = list({p["coin_id"] for p in positions})
    prices = await fetch_prices(coin_ids) if coin_ids else {}
    enriched = []
    total_value = 0.0
    total_cost = 0.0
    for p in positions:
        if p["amount"] <= 0:
            continue
        cur_price = prices.get(p["coin_id"], {}).get("price", 0)
        value = p["amount"] * cur_price
        cost = p.get("cost_basis", 0)
        total_value += value
        total_cost += cost
        enriched.append({**p, "current_price": cur_price, "value_usd": value, "pnl_usd": value - cost, "pnl_pct": ((value - cost) / cost * 100) if cost > 0 else 0})
    return {
        "balance_usd": current.paper_balance_usd,
        "positions": enriched,
        "positions_value_usd": total_value,
        "total_equity_usd": current.paper_balance_usd + total_value,
        "total_pnl_usd": total_value - total_cost,
    }

@api.post("/trades")
async def execute_trade(body: TradeIn, current: User = Depends(get_current_user)):
    return await _execute_trade(current.user_id, body.dict(), source="manual")

async def _execute_trade(user_id: str, body: dict, source: str = "manual", bot_id: Optional[str] = None):
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    balance = user_doc.get("paper_balance_usd", 0)
    side = body["side"]
    amount_usd = body["amount_usd"]
    price = body["price"]
    coin_id = body["coin_id"]
    if price <= 0:
        raise HTTPException(status_code=400, detail="Invalid price")
    coin_amount = amount_usd / price

    pos = await db.positions.find_one({"user_id": user_id, "coin_id": coin_id}, {"_id": 0})
    if side == "buy":
        if balance < amount_usd:
            raise HTTPException(status_code=400, detail="Insufficient balance")
        new_balance = balance - amount_usd
        if pos:
            new_amount = pos["amount"] + coin_amount
            new_cost = pos["cost_basis"] + amount_usd
            await db.positions.update_one({"user_id": user_id, "coin_id": coin_id},
                {"$set": {"amount": new_amount, "cost_basis": new_cost, "avg_price": new_cost / new_amount if new_amount > 0 else 0}})
        else:
            await db.positions.insert_one({
                "user_id": user_id, "coin_id": coin_id, "coin_symbol": body["coin_symbol"], "coin_name": body["coin_name"],
                "amount": coin_amount, "cost_basis": amount_usd, "avg_price": price,
            })
    else:  # sell
        if not pos or pos["amount"] < coin_amount:
            raise HTTPException(status_code=400, detail="Insufficient holdings")
        new_balance = balance + amount_usd
        new_amount = pos["amount"] - coin_amount
        # proportional cost basis
        cost_removed = pos["cost_basis"] * (coin_amount / pos["amount"]) if pos["amount"] > 0 else 0
        new_cost = pos["cost_basis"] - cost_removed
        await db.positions.update_one({"user_id": user_id, "coin_id": coin_id},
            {"$set": {"amount": new_amount, "cost_basis": new_cost}})
    await db.users.update_one({"user_id": user_id}, {"$set": {"paper_balance_usd": new_balance}})

    trade_id = f"trade_{uuid.uuid4().hex[:12]}"
    trade = {
        "trade_id": trade_id, "user_id": user_id,
        "coin_id": coin_id, "coin_symbol": body["coin_symbol"], "coin_name": body["coin_name"],
        "side": side, "amount_usd": amount_usd, "amount_coin": coin_amount, "price": price,
        "source": source, "bot_id": bot_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.trades.insert_one(trade)
    trade.pop("_id", None)
    return trade

@api.get("/trades")
async def list_trades(current: User = Depends(get_current_user), limit: int = 100):
    cursor = db.trades.find({"user_id": current.user_id}, {"_id": 0}).sort("timestamp", -1).limit(limit)
    return await cursor.to_list(limit)

# ---------- Bots ----------
@api.get("/bots")
async def list_bots(current: User = Depends(get_current_user)):
    cursor = db.bots.find({"user_id": current.user_id}, {"_id": 0})
    return await cursor.to_list(100)

@api.post("/bots")
async def create_bot(body: BotIn, current: User = Depends(get_current_user)):
    bot_id = f"bot_{uuid.uuid4().hex[:12]}"
    coin_data = await coin_detail(body.coin_id)
    entry_price = coin_data.get("price", 0)
    bot = {
        "bot_id": bot_id, "user_id": current.user_id,
        "name": body.name, "coin_id": body.coin_id, "coin_symbol": body.coin_symbol,
        "strategy": body.strategy, "allocation_usd": body.allocation_usd,
        "config": body.config, "active": True, "entry_price": entry_price,
        "trades_count": 0, "pnl_usd": 0.0,
        "last_run": None, "last_action": "INITIALIZED",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.bots.insert_one(bot)
    bot.pop("_id", None)
    return bot

@api.patch("/bots/{bot_id}/toggle")
async def toggle_bot(bot_id: str, current: User = Depends(get_current_user)):
    bot = await db.bots.find_one({"bot_id": bot_id, "user_id": current.user_id}, {"_id": 0})
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    new_state = not bot.get("active", True)
    await db.bots.update_one({"bot_id": bot_id}, {"$set": {"active": new_state}})
    return {"bot_id": bot_id, "active": new_state}

@api.delete("/bots/{bot_id}")
async def delete_bot(bot_id: str, current: User = Depends(get_current_user)):
    res = await db.bots.delete_one({"bot_id": bot_id, "user_id": current.user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bot not found")
    return {"ok": True}

# ---------- AI Signals (Claude) ----------
@api.get("/ai/signal/{coin_id}")
async def ai_signal(coin_id: str, current: User = Depends(get_current_user)):
    coin = await coin_detail(coin_id)
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="LLM key not configured")
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"signal-{current.user_id}-{coin_id}-{uuid.uuid4().hex[:6]}",
        system_message=(
            "You are an elite meme-coin trading analyst. Be concise. "
            "Reply STRICTLY in JSON with keys: signal (BUY|SELL|HOLD), confidence (0-100 int), "
            "reasoning (max 280 chars), risk (LOW|MED|HIGH). No markdown, no extra text."
        ),
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    prompt = (
        f"Coin: {coin.get('name')} ({coin.get('symbol')}) on {coin.get('chain')}. "
        f"Price USD: {coin.get('price')}. 24h change: {coin.get('change_24h'):.2f}%. "
        f"Market cap: {coin.get('market_cap'):,.0f}. 24h volume: {coin.get('volume_24h'):,.0f}. "
        f"Generate a trading signal."
    )
    try:
        resp = await chat.send_message(UserMessage(text=prompt))
        text = str(resp).strip()
        # try parse JSON
        import json, re
        m = re.search(r"\{.*\}", text, re.S)
        sig = json.loads(m.group(0)) if m else {"signal": "HOLD", "confidence": 50, "reasoning": text[:280], "risk": "MED"}
    except Exception as e:
        logger.exception("AI signal failed")
        sig = {"signal": "HOLD", "confidence": 0, "reasoning": f"AI unavailable: {e}", "risk": "HIGH"}
    sig["coin_id"] = coin_id
    sig["coin_symbol"] = coin.get("symbol")
    sig["price"] = coin.get("price")
    sig["timestamp"] = datetime.now(timezone.utc).isoformat()
    await db.ai_signals.insert_one({**sig, "user_id": current.user_id})
    sig.pop("_id", None)
    return sig

@api.get("/ai/signals")
async def list_signals(current: User = Depends(get_current_user), limit: int = 30):
    cursor = db.ai_signals.find({"user_id": current.user_id}, {"_id": 0}).sort("timestamp", -1).limit(limit)
    return await cursor.to_list(limit)

# ---------- Wallets ----------
@api.get("/wallets")
async def list_wallets(current: User = Depends(get_current_user)):
    cursor = db.wallets.find({"user_id": current.user_id}, {"_id": 0})
    return await cursor.to_list(20)

@api.post("/wallets")
async def add_wallet(body: WalletIn, current: User = Depends(get_current_user)):
    w = {"wallet_id": f"wallet_{uuid.uuid4().hex[:12]}", "user_id": current.user_id,
         "address": body.address, "chain": body.chain, "label": body.label,
         "connected_at": datetime.now(timezone.utc).isoformat()}
    await db.wallets.insert_one(w)
    w.pop("_id", None)
    return w

@api.delete("/wallets/{wallet_id}")
async def delete_wallet(wallet_id: str, current: User = Depends(get_current_user)):
    await db.wallets.delete_one({"wallet_id": wallet_id, "user_id": current.user_id})
    return {"ok": True}

# ---------- Bot Engine (background loop) ----------
async def evaluate_bot(bot: dict):
    cur = await coin_detail(bot["coin_id"])
    price = cur.get("price", 0)
    if price <= 0:
        return None, "NO_PRICE"
    cfg = bot.get("config", {})
    strategy = bot["strategy"]
    user_id = bot["user_id"]
    pos = await db.positions.find_one({"user_id": user_id, "coin_id": bot["coin_id"]}, {"_id": 0}) or {"amount": 0, "avg_price": 0}

    action = None
    reason = "HOLD"

    if strategy == "momentum":
        threshold = float(cfg.get("buy_change_pct", 5.0))
        sell_threshold = float(cfg.get("sell_change_pct", -3.0))
        change = cur.get("change_24h", 0) or 0
        if change >= threshold and pos["amount"] == 0:
            action = "buy"; reason = f"MOMENTUM: 24h+{change:.1f}%"
        elif change <= sell_threshold and pos["amount"] > 0:
            action = "sell"; reason = f"MOMENTUM: 24h{change:.1f}%"

    elif strategy == "dca":
        interval_min = int(cfg.get("interval_minutes", 60))
        last_run = bot.get("last_run")
        if last_run:
            last_dt = datetime.fromisoformat(last_run) if isinstance(last_run, str) else last_run
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            if (datetime.now(timezone.utc) - last_dt).total_seconds() < interval_min * 60:
                return None, "DCA_WAIT"
        action = "buy"; reason = f"DCA tick @ ${price:.6f}"

    elif strategy == "stop_loss_take_profit":
        if pos["amount"] == 0 and bot.get("entry_price", 0) > 0:
            action = "buy"; reason = "INITIAL_ENTRY"
        elif pos["amount"] > 0:
            avg = pos["avg_price"]
            stop_pct = float(cfg.get("stop_loss_pct", 10))
            tp_pct = float(cfg.get("take_profit_pct", 25))
            change_pct = (price - avg) / avg * 100 if avg > 0 else 0
            if change_pct <= -stop_pct:
                action = "sell"; reason = f"STOP_LOSS @ {change_pct:.1f}%"
            elif change_pct >= tp_pct:
                action = "sell"; reason = f"TAKE_PROFIT @ {change_pct:.1f}%"

    elif strategy == "ai_signal":
        # Use simple heuristic: positive momentum + volume signal AI-like
        change = cur.get("change_24h", 0) or 0
        if change > 8 and pos["amount"] == 0:
            action = "buy"; reason = f"AI: bullish surge +{change:.1f}%"
        elif change < -10 and pos["amount"] > 0:
            action = "sell"; reason = f"AI: bearish dump {change:.1f}%"

    if action == "buy":
        per_trade = float(cfg.get("per_trade_usd", min(bot["allocation_usd"], 100)))
        u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if u and u["paper_balance_usd"] >= per_trade:
            try:
                await _execute_trade(user_id, {
                    "coin_id": bot["coin_id"], "coin_symbol": bot["coin_symbol"], "coin_name": bot["coin_symbol"],
                    "side": "buy", "amount_usd": per_trade, "price": price,
                }, source="bot", bot_id=bot["bot_id"])
                await db.bots.update_one({"bot_id": bot["bot_id"]}, {"$inc": {"trades_count": 1}})
                return action, reason
            except Exception as e:
                return None, f"ERR:{e}"
    elif action == "sell" and pos["amount"] > 0:
        sell_value = pos["amount"] * price
        try:
            await _execute_trade(user_id, {
                "coin_id": bot["coin_id"], "coin_symbol": bot["coin_symbol"], "coin_name": bot["coin_symbol"],
                "side": "sell", "amount_usd": sell_value, "price": price,
            }, source="bot", bot_id=bot["bot_id"])
            await db.bots.update_one({"bot_id": bot["bot_id"]}, {"$inc": {"trades_count": 1}})
            return action, reason
        except Exception as e:
            return None, f"ERR:{e}"
    return None, reason

async def bot_engine_loop():
    """Run every 30s; evaluates all active bots."""
    await asyncio.sleep(5)
    while True:
        try:
            cursor = db.bots.find({"active": True}, {"_id": 0})
            bots = await cursor.to_list(500)
            for b in bots:
                action, reason = await evaluate_bot(b)
                await db.bots.update_one(
                    {"bot_id": b["bot_id"]},
                    {"$set": {"last_run": datetime.now(timezone.utc).isoformat(), "last_action": reason}},
                )
        except Exception as e:
            logger.exception(f"bot_engine error: {e}")
        await asyncio.sleep(30)

# ---------- Health ----------
@api.get("/")
async def root():
    return {"app": "Meme Coin Auto Trading", "status": "live"}

app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
