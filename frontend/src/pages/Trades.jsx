import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function Trades() {
  const [trades, setTrades] = useState([]);
  useEffect(() => {
    const load = () => api.get("/trades").then(r => setTrades(r.data || []));
    load(); const i=setInterval(load, 10000); return ()=>clearInterval(i);
  }, []);
  return (
    <div className="p-6 space-y-px">
      <div className="pb-4">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#00FF66]">[ TRADES ]</div>
        <h1 className="font-display text-2xl mt-1">EXECUTION_LOG</h1>
      </div>
      <div className="border border-[#1A1A24] bg-[#0C0C12]">
        <div className="px-4 py-3 border-b border-[#1A1A24] text-[10px] uppercase tracking-[0.3em] text-[#00FF66] flex justify-between">
          <span>[ HISTORY ]</span><span className="text-[#8B949E]">{trades.length} ENTRIES</span>
        </div>
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">
            <tr className="border-b border-[#1A1A24]">
              <th className="text-left py-3 px-4">TIME</th>
              <th className="text-left">COIN</th>
              <th className="text-left">SIDE</th>
              <th className="text-right">AMT_USD</th>
              <th className="text-right">QTY</th>
              <th className="text-right">PRICE</th>
              <th className="text-right pr-4">SOURCE</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(t => (
              <tr key={t.trade_id} className="border-b border-[#1A1A24] hover:bg-[#13131A]" data-testid={`trade-${t.trade_id}`}>
                <td className="py-3 px-4 text-[#8B949E]">{new Date(t.timestamp).toLocaleString()}</td>
                <td className="font-display">{t.coin_symbol}</td>
                <td className={t.side==='buy'?'text-[#00FF66]':'text-[#FF3366]'}>{t.side.toUpperCase()}</td>
                <td className="text-right">${t.amount_usd.toFixed(2)}</td>
                <td className="text-right">{t.amount_coin.toFixed(4)}</td>
                <td className="text-right">${t.price.toFixed(t.price < 1 ? 8 : 4)}</td>
                <td className="text-right pr-4">
                  <span className={`text-[10px] px-2 py-0.5 border ${t.source==='bot'?'border-[#FFB800] text-[#FFB800]':'border-[#1A1A24] text-[#8B949E]'}`}>{t.source.toUpperCase()}</span>
                </td>
              </tr>
            ))}
            {trades.length === 0 && <tr><td colSpan="7" className="py-12 text-center text-[#8B949E]">NO_TRADES<span className="blink-cursor"/></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
