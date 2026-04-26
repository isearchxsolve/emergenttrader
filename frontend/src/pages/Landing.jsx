import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";
import { ArrowRight, Lightning, ChartLine, Robot, Wallet as WalletIcon, ShieldCheck } from "@phosphor-icons/react";

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickers, setTickers] = useState([]);

  useEffect(() => {
    api.get("/coins/trending").then(r => setTickers(r.data || [])).catch(()=>{});
  }, []);

  return (
    <div className="min-h-screen bg-[#05050A] text-[#F8FAFC] font-mono terminal-grid">
      {/* Top bar */}
      <header className="border-b border-[#1A1A24] bg-[#05050A]/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-[#00FF66] text-[#00FF66] flex items-center justify-center font-display text-xs">M$</div>
            <div className="font-display text-sm tracking-widest" data-testid="brand-logo">MEMETRADE_<span className="text-[#00FF66]">TERMINAL</span></div>
          </div>
          <nav className="flex items-center gap-6 text-xs uppercase tracking-[0.2em] text-[#8B949E]">
            <a href="#features" className="hover:text-[#F8FAFC]">Features</a>
            <a href="#strategies" className="hover:text-[#F8FAFC]">Strategies</a>
            {user ? (
              <Link to="/dashboard" data-testid="goto-dashboard-btn" className="border border-[#00FF66] text-[#00FF66] px-4 py-2 hover:bg-[#00FF66] hover:text-[#05050A] transition-colors duration-100">DASHBOARD →</Link>
            ) : (
              <>
                <Link to="/login" data-testid="nav-login-btn" className="text-[#F8FAFC]">Login</Link>
                <Link to="/register" data-testid="nav-register-btn" className="border border-[#00FF66] text-[#00FF66] px-4 py-2 hover:bg-[#00FF66] hover:text-[#05050A] transition-colors duration-100">START_TRADING</Link>
              </>
            )}
          </nav>
        </div>
        {/* ticker */}
        {tickers.length > 0 && (
          <div className="border-t border-[#1A1A24] overflow-hidden">
            <div className="ticker py-2 text-xs">
              {[...tickers, ...tickers].map((c, i) => (
                <span key={`${c.id}-${i}`} className="px-6 text-[#8B949E]">
                  <span className="text-[#F8FAFC] font-bold">{c.symbol}</span>
                  <span className="ml-2">${(c.price ?? 0).toFixed(c.price < 1 ? 8 : 4)}</span>
                  <span className={`ml-2 ${c.change_24h >= 0 ? 'text-[#00FF66]' : 'text-[#FF3366]'}`}>
                    {c.change_24h >= 0 ? '+' : ''}{(c.change_24h ?? 0).toFixed(2)}%
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-12 gap-12">
        <div className="lg:col-span-7">
          <div className="text-xs uppercase tracking-[0.3em] text-[#00FF66] mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-[#00FF66] pulse-dot"/> SYSTEM_LIVE · 24/7 AUTO_EXEC
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
            TRADE_THE_MEMES.<br/>
            <span className="text-[#00FF66]">BEFORE_THEY_PUMP.</span>
          </h1>
          <p className="mt-8 text-[#8B949E] max-w-xl text-sm leading-relaxed">
            A degen-grade auto-trading terminal for Solana &amp; Ethereum meme coins. Deploy momentum bots, DCA ladders, stop-loss/take-profit triggers, and Claude-powered AI signals — all on a paper trading sandbox before risking real on-chain.
          </p>
          <div className="mt-10 flex items-center gap-4">
            <button onClick={() => navigate(user ? "/dashboard" : "/register")} data-testid="hero-cta-primary" className="group border border-[#00FF66] bg-[#00FF66] text-[#05050A] px-6 py-3 font-display text-sm tracking-wider hover:bg-transparent hover:text-[#00FF66] transition-colors duration-100 flex items-center gap-2">
              LAUNCH_TERMINAL <ArrowRight size={16} weight="bold" className="group-hover:translate-x-1 transition-transform"/>
            </button>
            <Link to="/login" data-testid="hero-cta-secondary" className="border border-[#1A1A24] hover:border-[#303040] px-6 py-3 font-display text-sm tracking-wider text-[#8B949E] hover:text-[#F8FAFC]">
              SIGN_IN
            </Link>
          </div>
          <div className="mt-12 grid grid-cols-3 gap-px bg-[#1A1A24] border border-[#1A1A24] max-w-lg">
            <Stat label="STRATEGIES" value="04"/>
            <Stat label="CHAINS" value="MULTI"/>
            <Stat label="MODE" value="PAPER+LIVE"/>
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="border border-[#1A1A24] bg-[#0C0C12] p-6 scanline">
            <div className="text-xs uppercase tracking-[0.2em] text-[#8B949E] mb-4">[ TRENDING_NOW ]</div>
            <div className="space-y-px">
              {tickers.slice(0,8).map(c => (
                <div key={c.id} className="flex items-center justify-between py-3 border-b border-[#1A1A24] last:border-0 hover:bg-[#13131A] px-2 cursor-pointer" onClick={() => navigate(`/coin/${c.id}`)} data-testid={`landing-trend-${c.symbol}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 border border-[#1A1A24] flex items-center justify-center text-[10px] text-[#00FF66]">{c.symbol.slice(0,3)}</div>
                    <div>
                      <div className="font-display text-sm">{c.symbol}</div>
                      <div className="text-[10px] text-[#8B949E] uppercase">{c.chain}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">${(c.price ?? 0).toFixed(c.price < 1 ? 8 : 4)}</div>
                    <div className={`text-xs ${c.change_24h >= 0 ? 'text-[#00FF66]' : 'text-[#FF3366]'}`}>
                      {c.change_24h >= 0 ? '▲' : '▼'} {Math.abs(c.change_24h ?? 0).toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
              {tickers.length === 0 && <div className="text-[#8B949E] text-xs py-12 text-center">LOADING_FEED<span className="blink-cursor"/></div>}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#1A1A24] border border-[#1A1A24]">
        {[
          { icon: Robot, title: "AUTO_BOTS", desc: "4 strategies running 24/7. Set allocation, walk away." },
          { icon: ChartLine, title: "LIVE_FEED", desc: "CoinGecko + DexScreener data piped in real-time." },
          { icon: Lightning, title: "AI_SIGNALS", desc: "Claude Sonnet 4.5 analyzes price action on-demand." },
          { icon: WalletIcon, title: "MULTI_CHAIN", desc: "Solana memecoins + Ethereum degen plays." },
        ].map(({icon:Icon,title,desc}) => (
          <div key={title} className="bg-[#0C0C12] p-6 hover:bg-[#13131A]">
            <Icon size={24} className="text-[#00FF66] mb-4"/>
            <div className="font-display text-sm tracking-wider">{title}</div>
            <div className="text-xs text-[#8B949E] mt-2 leading-relaxed">{desc}</div>
          </div>
        ))}
      </section>

      {/* Strategies */}
      <section id="strategies" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-xs uppercase tracking-[0.3em] text-[#00FF66] mb-3">[ STRATEGY_MATRIX ]</div>
        <h2 className="font-display text-2xl sm:text-3xl tracking-tight max-w-3xl">FOUR ENGINES. PICK YOUR ALPHA.</h2>
        <div className="mt-12 grid md:grid-cols-2 gap-px bg-[#1A1A24] border border-[#1A1A24]">
          {[
            { code: "01", name: "MOMENTUM", desc: "Buys when 24h change exceeds threshold. Sells on reversal. Riding the pump." },
            { code: "02", name: "DCA", desc: "Dollar-cost average buys at fixed intervals. Builds your bag without timing the market." },
            { code: "03", name: "STOP_LOSS / TAKE_PROFIT", desc: "Auto-exit at configurable -% (cut losses) or +% (lock gains)." },
            { code: "04", name: "AI_SIGNAL", desc: "Heuristic-driven AI engine flags surges and dumps. Use the on-demand Claude analyst for confirmation." },
          ].map(s => (
            <div key={s.code} className="bg-[#0C0C12] p-8 hover:bg-[#13131A]">
              <div className="flex items-baseline gap-3">
                <div className="text-[#00FF66] font-display text-xs">[{s.code}]</div>
                <div className="font-display text-lg tracking-wider">{s.name}</div>
              </div>
              <div className="text-sm text-[#8B949E] mt-4 leading-relaxed max-w-md">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-24 text-center border-t border-[#1A1A24]">
        <ShieldCheck size={32} className="text-[#00FF66] mx-auto mb-4"/>
        <h3 className="font-display text-2xl sm:text-3xl tracking-tight">$10,000 PAPER_BALANCE. ZERO_RISK.</h3>
        <p className="text-sm text-[#8B949E] mt-4 max-w-lg mx-auto">Start in simulated mode. Validate strategies. Connect wallet when you're ready to ape for real.</p>
        <Link to="/register" data-testid="footer-cta-btn" className="mt-8 inline-block border border-[#00FF66] bg-[#00FF66] text-[#05050A] px-8 py-4 font-display text-sm tracking-wider hover:bg-transparent hover:text-[#00FF66]">CREATE_ACCOUNT →</Link>
      </section>

      <footer className="border-t border-[#1A1A24] py-6 text-center text-xs text-[#8B949E]">
        MEMETRADE_TERMINAL // BUILT_FOR_DEGENS // v1.0
      </footer>
    </div>
  );
}

function Stat({label, value}) {
  return (
    <div className="bg-[#0C0C12] p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">{label}</div>
      <div className="font-display text-2xl text-[#00FF66] mt-1">{value}</div>
    </div>
  );
}
