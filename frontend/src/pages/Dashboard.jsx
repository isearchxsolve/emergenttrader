import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

export default function Dashboard() {
  const [trending, setTrending] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [selected, setSelected] = useState("dogecoin");
  const [chart, setChart] = useState([]);
  const [days, setDays] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const [t, p] = await Promise.all([api.get("/coins/trending"), api.get("/portfolio")]);
        setTrending(t.data || []);
        setPortfolio(p.data);
      } catch (e) { console.error(e); }
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    api.get(`/coins/${selected}/chart`, { params: { days } }).then(r => {
      setChart((r.data?.prices || []).map(p => ({ t: p.t, p: p.p })));
    });
  }, [selected, days]);

  const sel = trending.find(c => c.id === selected);

  return (
    <div className="p-6 space-y-px">
      <Header label="DASHBOARD" sublabel="MARKET_OVERVIEW · LIVE"/>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#1A1A24] border border-[#1A1A24]">
        <Kpi label="PAPER_BALANCE" value={`$${(portfolio?.balance_usd ?? 0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}`} testId="kpi-balance"/>
        <Kpi label="POSITIONS_VALUE" value={`$${(portfolio?.positions_value_usd ?? 0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}`} testId="kpi-positions-value"/>
        <Kpi label="TOTAL_EQUITY" value={`$${(portfolio?.total_equity_usd ?? 0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}`} testId="kpi-equity" accent/>
        <Kpi label="TOTAL_PNL" value={`${(portfolio?.total_pnl_usd ?? 0) >= 0 ? '+' : ''}$${(portfolio?.total_pnl_usd ?? 0).toFixed(2)}`} testId="kpi-pnl" pnl={portfolio?.total_pnl_usd ?? 0}/>
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-12 gap-px bg-[#1A1A24] border border-[#1A1A24] mt-px">
        {/* Trending */}
        <div className="lg:col-span-3 bg-[#0C0C12]">
          <PanelHeader title="[ TRENDING ]" right={<span className="text-[10px] text-[#8B949E]">{trending.length} COINS</span>}/>
          <div className="max-h-[520px] overflow-y-auto">
            {trending.map(c => (
              <button key={c.id} onClick={() => setSelected(c.id)} data-testid={`trending-${c.symbol}`} className={`w-full text-left px-3 py-3 flex items-center justify-between border-b border-[#1A1A24] hover:bg-[#13131A] ${selected === c.id ? 'bg-[#13131A] border-l-2 border-l-[#00FF66]' : ''}`}>
                <div>
                  <div className="font-display text-xs">{c.symbol}</div>
                  <div className="text-[10px] text-[#8B949E] uppercase">{c.chain}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs">${(c.price ?? 0).toFixed(c.price < 1 ? 6 : 2)}</div>
                  <div className={`text-[10px] ${c.change_24h >= 0 ? 'text-[#00FF66]' : 'text-[#FF3366]'}`}>
                    {c.change_24h >= 0 ? '+' : ''}{(c.change_24h ?? 0).toFixed(2)}%
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="lg:col-span-6 bg-[#0C0C12]">
          <PanelHeader title={`[ ${sel?.symbol || '...'} / USD ]`} right={
            <div className="flex gap-px bg-[#1A1A24]">
              {[1,7,30].map(d => (
                <button key={d} onClick={()=>setDays(d)} data-testid={`chart-tf-${d}`} className={`px-3 py-1 text-[10px] ${days===d?'bg-[#00FF66] text-[#05050A]':'bg-[#0C0C12] text-[#8B949E] hover:text-[#F8FAFC]'}`}>{d}D</button>
              ))}
            </div>
          }/>
          <div className="p-4">
            {sel && (
              <div className="flex items-baseline gap-4 mb-4">
                <div className="font-display text-3xl">${(sel.price ?? 0).toFixed(sel.price < 1 ? 8 : 4)}</div>
                <div className={`text-sm ${sel.change_24h >= 0 ? 'text-[#00FF66]' : 'text-[#FF3366]'}`}>
                  {sel.change_24h >= 0 ? '▲' : '▼'} {Math.abs(sel.change_24h ?? 0).toFixed(2)}% (24h)
                </div>
                <button onClick={() => navigate(`/coin/${sel.id}`)} data-testid="open-coin-detail" className="ml-auto border border-[#00FF66] text-[#00FF66] px-3 py-1 text-xs hover:bg-[#00FF66] hover:text-[#05050A] transition-colors">OPEN_TERMINAL →</button>
              </div>
            )}
            <div className="h-[380px]">
              <ResponsiveContainer>
                <LineChart data={chart}>
                  <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })} stroke="#8B949E" tick={{fill:'#8B949E', fontSize:10}}/>
                  <YAxis stroke="#8B949E" tick={{fill:'#8B949E', fontSize:10}} domain={['auto','auto']} tickFormatter={(v)=>v < 1 ? v.toFixed(6) : v.toFixed(2)} width={70}/>
                  <Tooltip contentStyle={{ background:'#05050A', border:'1px solid #00FF66', borderRadius:0, fontFamily:'IBM Plex Mono', fontSize:11 }} labelFormatter={(t)=>new Date(t).toLocaleString()} formatter={(v)=>['$'+(+v).toFixed(v<1?8:4),'PRICE']}/>
                  <Line type="monotone" dataKey="p" stroke="#00FF66" strokeWidth={1.5} dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Positions */}
        <div className="lg:col-span-3 bg-[#0C0C12]">
          <PanelHeader title="[ POSITIONS ]" right={<span className="text-[10px] text-[#8B949E]">{portfolio?.positions?.length || 0}</span>}/>
          <div className="max-h-[520px] overflow-y-auto">
            {(portfolio?.positions || []).map(p => (
              <div key={p.coin_id} className="px-3 py-3 border-b border-[#1A1A24] hover:bg-[#13131A] cursor-pointer" onClick={() => navigate(`/coin/${p.coin_id}`)} data-testid={`position-${p.coin_symbol}`}>
                <div className="flex justify-between">
                  <div className="font-display text-xs">{p.coin_symbol}</div>
                  <div className={`text-xs ${p.pnl_usd >= 0 ? 'text-[#00FF66]' : 'text-[#FF3366]'}`}>{p.pnl_usd >= 0 ? '+' : ''}${p.pnl_usd.toFixed(2)}</div>
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-[#8B949E]">
                  <span>{p.amount.toFixed(4)} @ ${p.avg_price.toFixed(p.avg_price < 1 ? 6 : 2)}</span>
                  <span>{p.pnl_pct >= 0 ? '+' : ''}{p.pnl_pct.toFixed(2)}%</span>
                </div>
              </div>
            ))}
            {(!portfolio?.positions || portfolio.positions.length === 0) && (
              <div className="p-6 text-[#8B949E] text-xs text-center">NO_POSITIONS<span className="blink-cursor"/></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Header({ label, sublabel }) {
  return (
    <div className="flex items-baseline justify-between pb-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#00FF66]">[ {label} ]</div>
        <h1 className="font-display text-2xl mt-1">{sublabel}</h1>
      </div>
      <div className="text-[10px] text-[#8B949E] flex items-center gap-2">
        <span className="w-2 h-2 bg-[#00FF66] pulse-dot"/> LIVE
      </div>
    </div>
  );
}
function Kpi({ label, value, accent, pnl, testId }) {
  const cls = pnl !== undefined ? (pnl >= 0 ? 'text-[#00FF66]' : 'text-[#FF3366]') : (accent ? 'text-[#00FF66]' : '');
  return (
    <div className="bg-[#0C0C12] p-5" data-testid={testId}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">{label}</div>
      <div className={`font-display text-2xl mt-2 ${cls}`}>{value}</div>
    </div>
  );
}
function PanelHeader({ title, right }) {
  return (
    <div className="flex items-center justify-between px-3 py-3 border-b border-[#1A1A24]">
      <div className="text-[10px] uppercase tracking-[0.3em] text-[#00FF66]">{title}</div>
      {right}
    </div>
  );
}
