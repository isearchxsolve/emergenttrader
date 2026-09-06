# MemeTrade Terminal

Meme coin trading app with:
- paper trading portfolio + bots
- Solana live swap path via Jupiter + Phantom
- AI signals, backtesting, webhook alerts

## Current Safety Model

- **Paper first**: portfolio/bots execute against internal paper balance.
- **Live path**: manual Solana swap via Jupiter transaction build + Phantom signature.
- **Risk controls** (backend):
  - per-trade max notional
  - minimum notional
  - daily loss proxy cap
  - max open positions
  - global trading pause/resume
  - quote freshness + slippage policy for Jupiter build path
  - idempotency key support on manual trade endpoint

## Architecture

- `backend/server.py`: FastAPI API, bot loop, risk checks, auth, webhook dispatch.
- `frontend/`: React app with trading UI, bots, wallet pages, live swap panel.
- MongoDB collections for users, trades, positions, bots, sessions, settings.

## Environment Variables (Backend)

Required:
- `MONGO_URL`
- `DB_NAME`
- `JWT_SECRET`

Optional:
- `EMERGENT_LLM_KEY`
- `CORS_ORIGINS` (comma-separated)

Risk controls:
- `MAX_TRADE_USD` (default `1000`)
- `MIN_NOTIONAL_USD` (default `1`)
- `MAX_DAILY_LOSS_USD` (default `500`)
- `MAX_OPEN_POSITIONS` (default `10`)
- `MAX_SLIPPAGE_BPS` (default `100`)
- `QUOTE_MAX_AGE_SEC` (default `15`)
- `TRADING_PAUSED` (`true`/`false`, default `false`)
- `BOT_ERROR_THRESHOLD` (default `5`)
- `BOT_COOLDOWN_SEC` (default `120`)
- `RECONCILE_INTERVAL_SEC` (default `300`)
- `ALLOWED_COIN_IDS` (optional CSV allowlist)
- `BLOCKED_COIN_IDS` (optional CSV blocklist)
- `ADMIN_EMAILS` (CSV emails allowed to run admin/ops endpoints)
- `ACTION_SIGNING_SECRET` (optional, enables required signed admin actions)

## Local Run

Backend:
- install deps from `backend/requirements.txt`
- run: `uvicorn server:app --host 0.0.0.0 --port 8000 --reload` in `backend`

Frontend:
- set `REACT_APP_BACKEND_URL`
- run in `frontend`: `yarn install` then `yarn start`

## Operational Endpoints

Authenticated:
- `GET /api/risk/status`
- `POST /api/risk/pause-all`
- `POST /api/risk/resume-all`
- `GET /api/metrics` (admin)
- `GET /api/ops/reconciliation/latest` (admin)
- `POST /api/ops/reconciliation/run` (admin)

Health:
- `GET /api/health/live`
- `GET /api/health/ready`

## Trade API Notes

`POST /api/trades` supports:
- header `X-Idempotency-Key`: repeat-safe submission key

## Go-Live Runbook (Minimal)

1. Start with paper-only; verify strategy behavior and logs.
2. Set strict risk envs (`MAX_TRADE_USD`, `MAX_DAILY_LOSS_USD`, `MAX_OPEN_POSITIONS`).
3. Enable live usage only for tiny notional and one operator wallet.
4. On incidents, call `POST /api/risk/pause-all`.
5. Reconcile balances/positions/trades, then `POST /api/risk/resume-all`.

If `ACTION_SIGNING_SECRET` is enabled, include:
- `X-Action-Timestamp`
- `X-Action-Signature`

Signature input format:
- `"{user_id}:{action}:{timestamp}"` where action is `pause_all` or `resume_all`
- `signature = HMAC_SHA256(ACTION_SIGNING_SECRET, payload)`

## Canary Plan

- Phase 1: paper only, 1-2 weeks.
- Phase 2: single user, single pair, tiny live notional.
- Phase 3: incremental scale with continuous monitoring.
