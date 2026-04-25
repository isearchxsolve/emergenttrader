import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash, Pause, Play } from "@phosphor-icons/react";

const STRATEGIES = [
  { id: "momentum", name: "MOMENTUM", desc: "Buy on +X% pump, sell on reversal", fields: [
    { key: "buy_change_pct", label: "BUY_AT_24H_+%", default: 5, type: "number", step: 0.1 },
    { key: "sell_change_pct", label: "SELL_AT_24H_%", default: -3, type: "number", step: 0.1 },
    { key: "per_trade_usd", label: "PER_TRADE_USD", default: 100, type: "number", step: 10 },
  ]},
  { id: "dca", name: "DCA", desc: "Periodic fixed-size buys", fields: [
    { key: "interval_minutes", label: "INTERVAL_MIN", default: 60, type: "number", step: 5 },
    { key: "per_trade_usd", label: "PER_TRADE_USD", default: 25, type: "number", step: 5 },
  ]},
  { id: "stop_loss_take_profit", name: "STOP / TP", desc: "Auto-exit on -% loss or +% gain", fields: [
    { key: "stop_loss_pct", label: "STOP_LOSS_%", default: 10, type: "number", step: 0.5 },
    { key: "take_profit_pct", label: "TAKE_PROFIT_%", default: 25, type: "number", step: 0.5 },
    { key: "per_trade_usd", label: "INITIAL_USD", default: 200, type: "number", step: 10 },
  ]},
  { id: "ai_signal", name: "AI_SIGNAL", desc: "Heuristic AI engine flags surges/dumps", fields: [
    { key: "per_trade_usd", label: "PER_TRADE_USD", default: 150, type: "number", step: 10 },
  ]},
];

export default function Bots() {
  const [bots, setBots] = useState([]);
  const [coins, setCoins] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [strategy, setStrategy] = useState("momentum");
  const [coinId, setCoinId] = useState("dogecoin");
  const [name, setName] = useState("");
  const [allocation, setAllocation] = useState(500);
  const [config, setConfig] = useState({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [b, c] = await Promise.all([api.get("/bots"), api.get("/coins/trending")]);
    setBots(b.data || []); setCoins(c.data || []);
  };
  useEffect(() => { load(); const i=setInterval(load, 15000); return ()=>clearInterval(i); }, []);

  useEffect(() => {
    const s = STRATEGIES.find(x => x.id === strategy);
    const def = {}; s.fields.forEach(f => def[f.key] = f.default);
    setConfig(def);
  }, [strategy]);

  const create = async () => {
    setBusy(true);
    try {
      const coin = coins.find(c => c.id === coinId);
      await api.post("/bots", {
        name: name || `${coin?.symbol}_${strategy.toUpperCase()}`,
        coin_id: coinId, coin_symbol: coin?.symbol || coinId.toUpperCase(),
        strategy, allocation_usd: parseFloat(allocation), config,
      });
      toast.success("Bot deployed.");
      setShowForm(false); setName(""); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Bot creation failed"); }
    finally { setBusy(false); }
  };

  const toggle = async (id) => { await api.patch(`/bots/${id}/toggle`); load(); };
  const remove = async (id) => { if (!window.confirm("Kill bot?")) return; await api.delete(`/bots/${id}`); load(); };

  const cur = STRATEGIES.find(s => s.id === strategy);

  return (
    <div className="p-6 space-y-px">
      <div className="flex items-baseline justify-between pb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#00FF66]">[ BOTS ]</div>
          <h1 className="font-display text-2xl mt-1">AUTO_TRADING_ENGINES</h1>
        </div>
        <button onClick={()=>setShowForm(v=>!v)} data-testid="new-bot-btn" className="border border-[#00FF66] bg-[#00FF66] text-[#05050A] px-4 py-2 font-display text-xs tracking-wider hover:bg-transparent hover:text-[#00FF66] transition-colors flex items-center gap-2"><Plus size={14}/>NEW_BOT</button>
      </div>

      {showForm && (
        <div className="border border-[#00FF66] bg-[#0C0C12] p-6 space-y-5">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#00FF66]">[ DEPLOY_BOT ]</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="STRATEGY">
              <select value={strategy} onChange={e=>setStrategy(e.target.value)} data-testid="bot-strategy-select" className="bg-transparent border border-[#1A1A24] focus:border-[#00FF66] px-3 py-2 text-sm w-full">
                {STRATEGIES.map(s => <option key={s.id} value={s.id} className="bg-[#0C0C12]">{s.name}</option>)}
              </select>
              <div className="text-[10px] text-[#8B949E] mt-1">{cur?.desc}</div>
            </Field>
            <Field label="COIN">
              <select value={coinId} onChange={e=>setCoinId(e.target.value)} data-testid="bot-coin-select" className="bg-transparent border border-[#1A1A24] focus:border-[#00FF66] px-3 py-2 text-sm w-full">
                {coins.map(c => <option key={c.id} value={c.id} className="bg-[#0C0C12]">{c.symbol} - {c.name}</option>)}
              </select>
            </Field>
            <Field label="BOT_NAME">
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="optional" data-testid="bot-name-input" className="bg-transparent border border-[#1A1A24] focus:border-[#00FF66] px-3 py-2 text-sm w-full"/>
            </Field>
            <Field label="ALLOCATION_USD">
              <input type="number" value={allocation} onChange={e=>setAllocation(e.target.value)} data-testid="bot-allocation-input" className="bg-transparent border border-[#1A1A24] focus:border-[#00FF66] px-3 py-2 text-sm w-full"/>
            </Field>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {cur?.fields.map(f => (
              <Field key={f.key} label={f.label}>
                <input type={f.type} step={f.step} value={config[f.key] ?? f.default} onChange={e=>setConfig({...config, [f.key]: parseFloat(e.target.value)})} data-testid={`bot-config-${f.key}`} className="bg-transparent border border-[#1A1A24] focus:border-[#00FF66] px-3 py-2 text-sm w-full"/>
              </Field>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={create} disabled={busy} data-testid="deploy-bot-btn" className="border border-[#00FF66] bg-[#00FF66] text-[#05050A] px-6 py-2 font-display text-xs tracking-wider hover:bg-transparent hover:text-[#00FF66] disabled:opacity-50">{busy?'DEPLOYING...':'DEPLOY →'}</button>
            <button onClick={()=>setShowForm(false)} className="border border-[#1A1A24] hover:border-[#FF3366] hover:text-[#FF3366] px-6 py-2 text-xs">CANCEL</button>
          </div>
        </div>
      )}

      <div className="border border-[#1A1A24] bg-[#0C0C12]">
        <div className="px-4 py-3 border-b border-[#1A1A24] text-[10px] uppercase tracking-[0.3em] text-[#00FF66] flex justify-between">
          <span>[ ACTIVE_BOTS ]</span><span className="text-[#8B949E]">{bots.length} TOTAL</span>
        </div>
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">
            <tr className="border-b border-[#1A1A24]"><th className="text-left py-3 px-4">NAME</th><th className="text-left">COIN</th><th className="text-left">STRATEGY</th><th className="text-right">ALLOC</th><th className="text-right">TRADES</th><th className="text-left pl-4">LAST_ACTION</th><th className="text-center">STATUS</th><th className="text-right pr-4">CTRL</th></tr>
          </thead>
          <tbody>
            {bots.map(b => (
              <tr key={b.bot_id} className="border-b border-[#1A1A24] hover:bg-[#13131A]" data-testid={`bot-row-${b.bot_id}`}>
                <td className="py-3 px-4 font-display">{b.name}</td>
                <td>{b.coin_symbol}</td>
                <td className="text-[#8B949E]">{b.strategy}</td>
                <td className="text-right">${b.allocation_usd}</td>
                <td className="text-right">{b.trades_count || 0}</td>
                <td className="pl-4 text-[#8B949E] text-[11px]">{b.last_action || '—'}</td>
                <td className="text-center">
                  <span className={`inline-flex items-center gap-1 ${b.active?'text-[#00FF66]':'text-[#8B949E]'}`}>
                    <span className={`w-1.5 h-1.5 ${b.active?'bg-[#00FF66] pulse-dot':'bg-[#8B949E]'}`}/>{b.active?'LIVE':'PAUSED'}
                  </span>
                </td>
                <td className="text-right pr-4">
                  <button onClick={()=>toggle(b.bot_id)} data-testid={`bot-toggle-${b.bot_id}`} className="border border-[#1A1A24] hover:border-[#FFB800] hover:text-[#FFB800] p-1 mr-1">{b.active?<Pause size={12}/>:<Play size={12}/>}</button>
                  <button onClick={()=>remove(b.bot_id)} data-testid={`bot-delete-${b.bot_id}`} className="border border-[#1A1A24] hover:border-[#FF3366] hover:text-[#FF3366] p-1"><Trash size={12}/></button>
                </td>
              </tr>
            ))}
            {bots.length === 0 && <tr><td colSpan="8" className="py-12 text-center text-[#8B949E]">NO_BOTS_DEPLOYED<span className="blink-cursor"/></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E] mb-1">{label}</div>
      {children}
    </div>
  );
}
