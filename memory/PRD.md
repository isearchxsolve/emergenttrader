# Meme Coin Auto Trading App – PRD

## Original Problem Statement
"Build a full fledged meme coin end to end auto trading app"
User chose: ALL options (paper + DEX, CoinGecko + DexScreener, all 4 strategies, JWT + Google auth, multi-chain).

## Architecture
- Backend: FastAPI + Motor (Mongo) + emergentintegrations (Claude Sonnet 4.5) + httpx
- Frontend: React 19 + Tailwind + Recharts + framer-motion + @phosphor-icons + sonner
- Bot Engine: asyncio background loop (every 30s) evaluating active bots
- Theme: Terminal/cyber dark green (#00FF66) with JetBrains Mono / IBM Plex Mono

## User Personas
- **Degens** – want fast meme-coin auto execution with tight risk controls
- **Strategy testers** – use paper-trading sandbox to validate ideas before risking SOL/ETH
- **AI-curious traders** – consume Claude-generated buy/sell/hold signals

## Core Requirements (Static)
1. Live multi-chain meme coin price feed (Solana + Ethereum)
2. Paper trading sandbox seeded with $10,000 USD
3. Four strategy engines: Momentum / DCA / Stop-Loss-Take-Profit / AI Signal
4. AI on-demand analysis (Claude Sonnet 4.5)
5. Dual auth: JWT email/password + Emergent Google OAuth
6. Wallet connect placeholder (Phantom + MetaMask, plus manual address)
7. Trade history, portfolio P&L, bot performance dashboard

## Implemented (2026-04-25)
- ✅ JWT register/login/me/logout with Bearer token + Emergent Google session_id flow
- ✅ CoinGecko trending + per-coin + chart endpoints with CoinPaprika fallback (and synthetic walk if both fail)
- ✅ DexScreener trending pairs endpoint
- ✅ Paper portfolio endpoint with positions, equity, total P&L
- ✅ Manual buy/sell trades with insufficient-balance / insufficient-holdings guards
- ✅ Bots CRUD + toggle for all 4 strategies, background evaluator every 30s
- ✅ Claude Sonnet 4.5 AI signals (BUY/SELL/HOLD + confidence + risk + reasoning)
- ✅ Wallets CRUD with Phantom/MetaMask web3 connect attempts
- ✅ Frontend: Landing (with live ticker), Login, Register, Dashboard (KPI grid + chart + trending + positions), Coin Detail (chart + BUY/SELL + AI signal), Bots, Trades, Signals, Wallet
- ✅ Tested: 29/29 backend pytest cases passed; frontend e2e validated

## Backlog (Prioritized)
- **P0** Fix MOG / very-low-price precision via Decimal in trade math
- **P1** Real on-chain DEX execution (Jupiter for SOL, 0x/Uniswap for ETH) when wallet is connected
- **P1** Backtest engine for strategies (replay last 30/90d)
- **P2** Per-strategy P&L analytics + win-rate per bot
- **P2** Webhooks / Telegram alerts on AI signal generation
- **P2** Refactor server.py into routers (auth/coins/trades/bots/ai/wallets)
- **P2** Replace static JWT_SECRET with environment-rotated secret for production

## Test Credentials
- See `/app/memory/test_credentials.md`

## Known Limitations
- DEX execution is paper/simulated only (live trading is a P1 backlog item)
- Chart history may use synthetic random-walk fallback if both CoinGecko and CoinPaprika fail
