import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash, LinkSimple } from "@phosphor-icons/react";

export default function Wallet() {
  const [wallets, setWallets] = useState([]);
  const [show, setShow] = useState(false);
  const [chain, setChain] = useState("solana");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [dexPairs, setDexPairs] = useState([]);

  const load = async () => {
    const [w, d] = await Promise.all([api.get("/wallets"), api.get("/coins/dex/trending")]);
    setWallets(w.data || []); setDexPairs(d.data?.pairs || []);
  };
  useEffect(() => { load(); }, []);

  const tryConnect = async (provider) => {
    try {
      if (provider === 'phantom') {
        if (!window.solana) { toast.error("Phantom not installed"); return; }
        const r = await window.solana.connect();
        setAddress(r.publicKey.toString()); setChain("solana"); setLabel("Phantom"); setShow(true);
      } else if (provider === 'metamask') {
        if (!window.ethereum) { toast.error("MetaMask not installed"); return; }
        const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAddress(accs[0]); setChain("ethereum"); setLabel("MetaMask"); setShow(true);
      }
    } catch (e) { toast.error("Wallet connect rejected"); }
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.post("/wallets", { address, chain, label });
      toast.success("Wallet linked");
      setShow(false); setAddress(""); setLabel(""); load();
    } catch (e) { toast.error("Failed"); }
    finally { setBusy(false); }
  };

  const remove = async (id) => { await api.delete(`/wallets/${id}`); load(); };

  return (
    <div className="p-6 space-y-px">
      <div className="pb-4">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#00FF66]">[ WALLETS ]</div>
        <h1 className="font-display text-2xl mt-1">CONNECTED_WALLETS</h1>
        <p className="text-xs text-[#8B949E] mt-2">Link your Solana / Ethereum wallets. Live trading is gated; current execution is paper-mode for safety.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-px bg-[#1A1A24] border border-[#1A1A24]">
        <button onClick={()=>tryConnect('phantom')} data-testid="connect-phantom-btn" className="bg-[#0C0C12] hover:bg-[#13131A] p-6 text-left">
          <div className="font-display text-sm">[SOL] PHANTOM</div>
          <div className="text-xs text-[#8B949E] mt-2">Solana wallet • for memes on Solana</div>
        </button>
        <button onClick={()=>tryConnect('metamask')} data-testid="connect-metamask-btn" className="bg-[#0C0C12] hover:bg-[#13131A] p-6 text-left">
          <div className="font-display text-sm">[ETH] METAMASK</div>
          <div className="text-xs text-[#8B949E] mt-2">Ethereum wallet • for ERC-20 memes</div>
        </button>
        <button onClick={()=>setShow(true)} data-testid="manual-add-btn" className="bg-[#0C0C12] hover:bg-[#13131A] p-6 text-left">
          <div className="font-display text-sm flex items-center gap-2"><Plus size={14}/>MANUAL_ADD</div>
          <div className="text-xs text-[#8B949E] mt-2">Paste any wallet address (read-only)</div>
        </button>
      </div>

      {show && (
        <div className="border border-[#00FF66] bg-[#0C0C12] p-6 space-y-4 mt-px">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#00FF66]">[ ADD_WALLET ]</div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">CHAIN</div>
              <select value={chain} onChange={e=>setChain(e.target.value)} data-testid="wallet-chain-select" className="mt-1 w-full bg-transparent border border-[#1A1A24] focus:border-[#00FF66] px-3 py-2 text-sm">
                <option value="solana" className="bg-[#0C0C12]">SOLANA</option>
                <option value="ethereum" className="bg-[#0C0C12]">ETHEREUM</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">ADDRESS</div>
              <input value={address} onChange={e=>setAddress(e.target.value)} data-testid="wallet-address-input" className="mt-1 w-full bg-transparent border border-[#1A1A24] focus:border-[#00FF66] px-3 py-2 text-sm font-mono"/>
            </div>
            <div className="sm:col-span-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">LABEL</div>
              <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="My Phantom" data-testid="wallet-label-input" className="mt-1 w-full bg-transparent border border-[#1A1A24] focus:border-[#00FF66] px-3 py-2 text-sm"/>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={!address || busy} data-testid="save-wallet-btn" className="border border-[#00FF66] bg-[#00FF66] text-[#05050A] px-6 py-2 font-display text-xs tracking-wider hover:bg-transparent hover:text-[#00FF66] disabled:opacity-50">{busy?'SAVING...':'LINK_WALLET'}</button>
            <button onClick={()=>setShow(false)} className="border border-[#1A1A24] hover:border-[#FF3366] hover:text-[#FF3366] px-6 py-2 text-xs">CANCEL</button>
          </div>
        </div>
      )}

      <div className="border border-[#1A1A24] bg-[#0C0C12] mt-px">
        <div className="px-4 py-3 border-b border-[#1A1A24] text-[10px] uppercase tracking-[0.3em] text-[#00FF66]">[ LINKED ]</div>
        <div className="divide-y divide-[#1A1A24]">
          {wallets.map(w => (
            <div key={w.wallet_id} className="px-4 py-4 flex items-center justify-between" data-testid={`wallet-${w.wallet_id}`}>
              <div>
                <div className="font-display text-xs">[{w.chain.toUpperCase()}] {w.label || 'WALLET'}</div>
                <div className="text-[11px] text-[#8B949E] mt-1 font-mono break-all">{w.address}</div>
              </div>
              <button onClick={()=>remove(w.wallet_id)} className="border border-[#1A1A24] hover:border-[#FF3366] hover:text-[#FF3366] p-2"><Trash size={12}/></button>
            </div>
          ))}
          {wallets.length === 0 && <div className="p-8 text-center text-[#8B949E] text-xs">NO_WALLETS_LINKED<span className="blink-cursor"/></div>}
        </div>
      </div>

      <div className="border border-[#1A1A24] bg-[#0C0C12] mt-px">
        <div className="px-4 py-3 border-b border-[#1A1A24] text-[10px] uppercase tracking-[0.3em] text-[#00FF66] flex justify-between">
          <span>[ DEX_TRENDING ]</span><span className="text-[#8B949E]">DexScreener live</span>
        </div>
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">
            <tr className="border-b border-[#1A1A24]"><th className="text-left py-3 px-4">SYMBOL</th><th className="text-left">CHAIN</th><th className="text-right">PRICE</th><th className="text-right">24H</th><th className="text-right">VOLUME</th><th className="text-right">LIQ</th><th className="pr-4"></th></tr>
          </thead>
          <tbody>
            {dexPairs.map((p, i) => (
              <tr key={i} className="border-b border-[#1A1A24] hover:bg-[#13131A]">
                <td className="py-2 px-4 font-display">{p.symbol}</td>
                <td className="text-[#8B949E]">{p.chain}</td>
                <td className="text-right">${(p.price_usd ?? 0).toFixed(p.price_usd < 1 ? 8 : 4)}</td>
                <td className={`text-right ${p.change_24h >= 0 ? 'text-[#00FF66]' : 'text-[#FF3366]'}`}>{(p.change_24h ?? 0).toFixed(2)}%</td>
                <td className="text-right">${Math.round(p.volume_24h || 0).toLocaleString()}</td>
                <td className="text-right">${Math.round(p.liquidity || 0).toLocaleString()}</td>
                <td className="pr-4 text-right"><a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[#00FF66] hover:underline inline-flex items-center gap-1"><LinkSimple size={12}/></a></td>
              </tr>
            ))}
            {dexPairs.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-[#8B949E]">LOADING_DEX_FEED<span className="blink-cursor"/></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
