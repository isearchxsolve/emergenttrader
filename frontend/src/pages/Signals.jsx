import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Lightning } from "@phosphor-icons/react";

export default function Signals() {
  const [signals, setSignals] = useState([]);
  const [coins, setCoins] = useState([]);
  const [coinId, setCoinId] = useState("dogecoin");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [s, c] = await Promise.all([api.get("/ai/signals"), api.get("/coins/trending")]);
    setSignals(s.data || []); setCoins(c.data || []);
  };
  useEffect(() => { load(); }, []);

  const run = async () => {
    setBusy(true);
    try {
      await api.get(`/ai/signal/${coinId}`);
      toast.success("Signal generated");
      load();
    } catch { toast.error("Signal failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-6 space-y-px">
      <div className="pb-4">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#00FF66]">[ AI_SIGNALS ]</div>
        <h1 className="font-display text-2xl mt-1">CLAUDE_ANALYSIS_FEED</h1>
      </div>

      <div className="border border-[#1A1A24] bg-[#0C0C12] p-6 flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">TARGET_COIN</div>
          <select value={coinId} onChange={e=>setCoinId(e.target.value)} data-testid="signal-coin-select" className="mt-1 w-full bg-transparent border border-[#1A1A24] focus:border-[#00FF66] px-3 py-2 text-sm">
            {coins.map(c => <option key={c.id} value={c.id} className="bg-[#0C0C12]">{c.symbol} — {c.name}</option>)}
          </select>
        </div>
        <button onClick={run} disabled={busy} data-testid="generate-signal-btn" className="border border-[#00FF66] bg-[#00FF66] text-[#05050A] px-5 py-2 font-display text-xs tracking-wider hover:bg-transparent hover:text-[#00FF66] disabled:opacity-50 flex items-center gap-2">
          <Lightning size={14} weight="bold"/>{busy?'ANALYZING...':'GENERATE_SIGNAL'}
        </button>
      </div>

      <div className="border border-[#1A1A24] bg-[#0C0C12]">
        <div className="px-4 py-3 border-b border-[#1A1A24] text-[10px] uppercase tracking-[0.3em] text-[#00FF66]">[ SIGNAL_HISTORY ]</div>
        <div className="divide-y divide-[#1A1A24]">
          {signals.map((s, i) => (
            <div key={i} className="p-4 hover:bg-[#13131A]" data-testid={`signal-row-${i}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="font-display text-sm">{s.coin_symbol}</div>
                  <span className={`text-xs px-2 py-0.5 border ${s.signal==='BUY'?'border-[#00FF66] text-[#00FF66]':s.signal==='SELL'?'border-[#FF3366] text-[#FF3366]':'border-[#FFB800] text-[#FFB800]'}`}>{s.signal}</span>
                  <span className="text-xs text-[#8B949E]">CONFIDENCE: <span className="text-[#F8FAFC]">{s.confidence}%</span></span>
                  <span className="text-xs text-[#8B949E]">RISK: <span className={s.risk==='LOW'?'text-[#00FF66]':s.risk==='HIGH'?'text-[#FF3366]':'text-[#FFB800]'}>{s.risk}</span></span>
                </div>
                <div className="text-[10px] text-[#8B949E]">{new Date(s.timestamp).toLocaleString()}</div>
              </div>
              <div className="text-xs text-[#8B949E] mt-2 leading-relaxed">{s.reasoning}</div>
            </div>
          ))}
          {signals.length === 0 && <div className="p-12 text-center text-[#8B949E] text-xs">NO_SIGNALS_YET<span className="blink-cursor"/></div>}
        </div>
      </div>
    </div>
  );
}
