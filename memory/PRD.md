# Meme Coin Auto Trading App – PRD

## Original Problem Statement
"Build a full fledged meme coin end to end auto trading app"
User chose: ALL options + P0/P1/P2 expansion (Decimal precision, Backtest, On-chain swap, Webhook alerts).

## Architecture
- Backend: FastAPI + Motor (Mongo) + emergentintegrations (Claude Sonnet 4.5) + httpx + Decimal precision
- Frontend: React 19 + Tailwind + Recharts + framer-motion + @phosphor-icons + sonner + @solana/web3.js
- Bot Engine: asyncio background loop (every 30s) evaluating active bots
- Theme: Terminal/cyber dark green (#00FF66) with JetBrains Mono / IBM Plex Mono
- Real DEX: Jupiter (Solana) via lite-api.jup.ag (no key) + Phantom signing; 1inch hand-off for ETH

## Implemented (2026-04-25 to 2026-04-26)
**Iteration 1 (MVP):**
- ✅ Dual auth (JWT + Emergent Google OAuth)
- ✅ CoinGecko + CoinPaprika price feed (with synthetic walk fallback)
- ✅ DexScreener trending pairs
- ✅ Paper portfolio + 4 strategy bots (Momentum / DCA / Stop-Loss-Take-Profit / AI Signal) on 30s evaluator
- ✅ Claude Sonnet 4.5 AI signals
- ✅ Wallet linking (Phantom/MetaMask)
- ✅ All UI pages: Landing, Login/Register, Dashboard, Coin Detail, Bots, Trades, Signals, Wallet

**Iteration 2 (P0 + P1 + P2):**
- ✅ **P0 Decimal precision** — `_execute_trade` uses Decimal (40-digit precision) for amount_coin / cost_basis math. Verified: $50 of MOG @ 1.5e-7 = ~329M MOG with sub-1e-6 relative precision.
- ✅ **P1 Backtest engine** — `POST /api/backtest` replays strategy on historical price series; returns starting/ending equity, P&L, trade list, equity curve. UI on Bots page with Recharts equity chart.
- ✅ **P1 Real on-chain swap** — Jupiter v1 quote/build endpoints proxied via lite-api.jup.ag (no key). Frontend `LiveSwap` component connects Phantom, displays quote, signs `VersionedTransaction`, submits to mainnet RPC, opens Solscan link. ETH coins hand off to 1inch.
- ✅ **P2 Webhook alerts** — `/api/settings` CRUD + `/api/settings/test-webhook`. Auto-formatted payloads for Discord & Slack; raw JSON for generic endpoints. Fired fire-and-forget on trade execution + AI signal generation.
- ✅ **P2 Per-bot P&L analytics** — `GET /api/bots` enriches each bot with `pnl_usd` / `pnl_pct` / `coins_held` computed from realized + unrealized positions.

## Backlog Remaining
- **P2** Telegram bot integration (needs bot_token + chat_id from user)
- **P2** Modular routers refactor (server.py is ~950 lines)
- **P2** ETH live swap via 1inch backend proxy (currently link-out only)
- **P3** Backtest comparison mode (run multiple strategies side-by-side)
- **P3** Portfolio analytics dashboard (per-coin P&L, win-rate, Sharpe)

## Test Status
- Backend: **43/43 pytest** (29 baseline + 14 iteration-2)
- Frontend: 100% UI flows verified incl. Settings, Bots backtest, Coin Detail PAPER/LIVE toggle

## Test Credentials
See `/app/memory/test_credentials.md`

## Known Limitations
- Phantom on-chain signing requires user wallet — UI shows connect flow but real signing requires browser extension and SOL gas
- 1inch ETH path opens external app; no programmatic ETH swaps yet
- Static JWT_SECRET; rotate before production
