import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { toast } from "sonner";
import { ArrowLeft, Lightning } from "@phosphor-icons/react";
import LiveSwap from "@/components/LiveSwap";

export default function CoinDetail() {
  const { coinId } = useParams();
  const navigate = useNavigate();
  const [coin, setCoin] = useState(null);
  const [chart, setChart] = useState([]);
  const [days, setDays] = useState(7);
  const [side, setSide] = useState("buy");
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState(false);
  const [signal, setSignal] = useState(null);
  const [signalLoading, setSignalLoading] = useState(false);
  const [portfolio, setPortfolio] = useState(null);
  const [mode, setMode] = useState("paper"); // 'paper' | 'live'

  const refresh = async () => {
    const [c, p] = await Promise.all([api.get(`/coins/${coinId}`), api.get("/portfolio")]);
    setCoin(c.data); setPortfolio(p.data);
  };
  useEffect(() => { refresh(); const i = setInterval(refresh, 20000); return ()=>clearInterval(i); }, [coinId]);
  useEffect(() => { api.get(`/coins/${coinId}/chart`, { params: { days } }).then(r => setChart((r.data?.prices||[]).map(p=>({t:p.t,p:p.p})))); }, [coinId, days]);

  const trade = async () => {
    if (!coin?.price) return toast.error("No price data");
    setBusy(true);
    try {
      await api.post("/trades", {
        coin_id: coin.id, coin_symbol: coin.symbol, coin_name: coin.name,
        side, amount_usd: parseFloat(amount), price: coin.price,
      });
      toast.success(`${side.toUpperCase()} executed: $${amount} of ${coin.symbol}`);
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Trade failed");
    } finally { setBusy(false); }
  };

  const getSignal = async () => {
    setSignalLoading(true);
    try {
      const r = await api.get(`/ai/signal/${coinId}`);
      setSignal(r.data);
    } catch (e) {
      toast.error("AI signal failed");
    } finally { setSignalLoading(false); }
  };

  const position = portfolio?.positions?.find(p => p.coin_id === coinId);

  return (
    <div className="p-6 space-y-px">
      <button onClick={()=>navigate(-1)} data-testid="back-btn" className="text-xs text-[#8B949E] hover:text-[#F8FAFC] flex items-center gap-2 mb-3"><ArrowLeft size={12}/> BACK</button>

      {coin && (
        <div className="border border-[#1A1A24] bg-[#0C0C12] p-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-baseline gap-3">
              <div className="font-display text-3xl">{coin.symbol}</div>
              <div className="text-xs text-[#8B949E] uppercase">{coin.name} · {coin.chain}</div>
            </div>
            <div className="font-display text-5xl mt-3">${(coin.price ?? 0).toFixed(coin.price < 1 ? 8 : 4)}</div>
            <div className={`text-sm mt-1 ${coin.change_24h >= 0 ? 'text-[#00FF66]' : 'text-[#FF3366]'}`}>
              {coin.change_24h >= 0 ? '▲' : '▼'} {Math.abs(coin.change_24h ?? 0).toFixed(2)}% (24h)
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-[#1A1A24] border border-[#1A1A24] text-xs">
            <Stat label="MARKET_CAP" value={fmt(coin.market_cap)}/>
            <Stat label="VOLUME_24H" value={fmt(coin.volume_24h)}/>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-px bg-[#1A1A24] border border-[#1A1A24] mt-px">
        {/* Chart */}
        <div className="lg:col-span-8 bg-[#0C0C12]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A1A24]">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#00FF66]">[ PRICE_FEED ]</div>
            <div className="flex gap-px bg-[#1A1A24]">
              {[1,7,30,90].map(d => (
                <button key={d} onClick={()=>setDays(d)} data-testid={`detail-tf-${d}`} className={`px-3 py-1 text-[10px] ${days===d?'bg-[#00FF66] text-[#05050A]':'bg-[#0C0C12] text-[#8B949E] hover:text-[#F8FAFC]'}`}>{d}D</button>
              ))}
            </div>
          </div>
          <div className="p-4 h-[420px]">
            <ResponsiveContainer>
              <LineChart data={chart}>
                <XAxis dataKey="t" tickFormatter={(t)=>new Date(t).toLocaleDateString()} stroke="#8B949E" tick={{fill:'#8B949E', fontSize:10}}/>
                <YAxis stroke="#8B949E" tick={{fill:'#8B949E', fontSize:10}} tickFormatter={(v)=>v<1?v.toFixed(6):v.toFixed(2)} width={70}/>
                <Tooltip contentStyle={{ background:'#05050A', border:'1px solid #00FF66', borderRadius:0, fontFamily:'IBM Plex Mono', fontSize:11 }}/>
                <Line type="monotone" dataKey="p" stroke="#00FF66" strokeWidth={1.5} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side panel */}
        <div className="lg:col-span-4 bg-[#0C0C12] flex flex-col">
          {/* Trade box */}
          <div>
            <div className="px-4 py-3 border-b border-[#1A1A24] flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#00FF66]">[ EXEC_TRADE ]</div>
              <div className="flex gap-px bg-[#1A1A24]">
                <button onClick={()=>setMode("paper")} data-testid="mode-paper-btn" className={`px-2 py-0.5 text-[10px] ${mode==='paper'?'bg-[#00FF66] text-[#05050A]':'bg-[#0C0C12] text-[#8B949E]'}`}>PAPER</button>
                <button onClick={()=>setMode("live")} data-testid="mode-live-btn" className={`px-2 py-0.5 text-[10px] ${mode==='live'?'bg-[#FFB800] text-[#05050A]':'bg-[#0C0C12] text-[#8B949E]'}`}>LIVE</button>
              </div>
            </div>
            {mode === 'live' ? (
              <LiveSwap coin={coin}/>
            ) : (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-px bg-[#1A1A24]">
                <button onClick={()=>setSide("buy")} data-testid="side-buy-btn" className={`py-2 text-xs font-display tracking-wider ${side==='buy'?'bg-[#00FF66] text-[#05050A]':'bg-[#0C0C12] text-[#8B949E] hover:text-[#F8FAFC]'}`}>BUY</button>
                <button onClick={()=>setSide("sell")} data-testid="side-sell-btn" className={`py-2 text-xs font-display tracking-wider ${side==='sell'?'bg-[#FF3366] text-[#05050A]':'bg-[#0C0C12] text-[#8B949E] hover:text-[#F8FAFC]'}`}>SELL</button>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">AMOUNT_USD</label>
                <input data-testid="trade-amount-input" type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)} className="mt-1 w-full bg-transparent border border-[#1A1A24] focus:border-[#00FF66] px-3 py-2 text-sm font-display"/>
              </div>
              <div className="text-[10px] text-[#8B949E] flex justify-between">
                <span>BALANCE</span><span className="text-[#F8FAFC]">${(portfolio?.balance_usd ?? 0).toFixed(2)}</span>
              </div>
              {position && (
                <div className="text-[10px] text-[#8B949E] flex justify-between">
                  <span>HOLDING</span><span className="text-[#F8FAFC]">{position.amount.toFixed(4)} {coin?.symbol}</span>
                </div>
              )}
              <button onClick={trade} disabled={busy || !coin?.price} data-testid="execute-trade-btn" className={`w-full py-3 font-display text-sm tracking-wider transition-colors duration-100 disabled:opacity-50 ${side==='buy'?'border border-[#00FF66] bg-[#00FF66] text-[#05050A] hover:bg-transparent hover:text-[#00FF66]':'border border-[#FF3366] bg-[#FF3366] text-[#05050A] hover:bg-transparent hover:text-[#FF3366]'}`}>
                {busy ? 'EXECUTING...' : `${side.toUpperCase()}_${coin?.symbol || ''} @ MKT`}
              </button>
            </div>
            )}
          </div>

          {/* AI signal */}
          <div className="border-t border-[#1A1A24]">
            <div className="px-4 py-3 border-b border-[#1A1A24] text-[10px] uppercase tracking-[0.3em] text-[#00FF66] flex items-center justify-between">
              <span>[ AI_SIGNAL ]</span>
              <button onClick={getSignal} disabled={signalLoading} data-testid="run-ai-signal-btn" className="border border-[#00FF66] text-[#00FF66] px-2 py-0.5 text-[10px] hover:bg-[#00FF66] hover:text-[#05050A] disabled:opacity-50 flex items-center gap-1"><Lightning size={10}/>{signalLoading?'ANALYZING':'RUN'}</button>
            </div>
            <div className="p-4">
              {signalLoading && <div className="text-xs text-[#8B949E]">CLAUDE_ANALYZING<span className="blink-cursor"/></div>}
              {!signalLoading && !signal && <div className="text-xs text-[#8B949E]">AWAITING_SIGNAL<span className="blink-cursor"/></div>}
              {signal && (
                <div className="space-y-2 text-xs" data-testid="ai-signal-result">
                  <div className="flex justify-between"><span className="text-[#8B949E]">SIGNAL</span><span className={`font-display ${signal.signal==='BUY'?'text-[#00FF66]':signal.signal==='SELL'?'text-[#FF3366]':'text-[#FFB800]'}`}>{signal.signal}</span></div>
                  <div className="flex justify-between"><span className="text-[#8B949E]">CONFIDENCE</span><span className="font-display">{signal.confidence}%</span></div>
                  <div className="flex justify-between"><span className="text-[#8B949E]">RISK</span><span className={`font-display ${signal.risk==='LOW'?'text-[#00FF66]':signal.risk==='HIGH'?'text-[#FF3366]':'text-[#FFB800]'}`}>{signal.risk}</span></div>
                  <div className="text-[#8B949E] text-[11px] mt-2 leading-relaxed">{signal.reasoning}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-[#0C0C12] p-4 min-w-[160px]">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">{label}</div>
      <div className="font-display text-base mt-1">{value}</div>
    </div>
  );
}
function fmt(n) {
  if (!n) return '—';
  if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n/1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}
