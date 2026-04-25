import { useEffect, useState } from "react";
import { Connection, VersionedTransaction, PublicKey } from "@solana/web3.js";
import api from "@/lib/api";
import { toast } from "sonner";
import { Lightning, LinkSimple } from "@phosphor-icons/react";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const RPC = "https://api.mainnet-beta.solana.com";

/**
 * Live Swap (Solana via Jupiter) panel.
 * - For SOL meme coins (with `mint`): full Jupiter quote + Phantom sign flow.
 * - For ETH/multi: opens 1inch swap UI in new tab as a hand-off.
 */
export default function LiveSwap({ coin }) {
  const [phantomAddr, setPhantomAddr] = useState(null);
  const [side, setSide] = useState("buy");
  const [amountSol, setAmountSol] = useState(0.1);
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (window?.solana?.isPhantom && window.solana.publicKey) {
      setPhantomAddr(window.solana.publicKey.toString());
    }
  }, []);

  const isSolana = coin?.chain === "solana" && coin?.mint;

  const connect = async () => {
    if (!window.solana) { toast.error("Phantom wallet not detected"); return; }
    try {
      const r = await window.solana.connect();
      setPhantomAddr(r.publicKey.toString());
      toast.success("Phantom connected");
    } catch { toast.error("Connection rejected"); }
  };

  const getQuote = async () => {
    if (!isSolana) return;
    setBusy(true); setQuote(null);
    try {
      const lamports = Math.floor(parseFloat(amountSol) * 1_000_000_000);
      const params = side === "buy"
        ? { input_mint: SOL_MINT, output_mint: coin.mint, amount: lamports }
        : { input_mint: coin.mint, output_mint: SOL_MINT, amount: lamports };
      const r = await api.get("/swap/jupiter/quote", { params: { ...params, slippage_bps: 100 } });
      setQuote(r.data);
    } catch (e) { toast.error(e?.response?.data?.detail || "Quote failed"); }
    finally { setBusy(false); }
  };

  const execute = async () => {
    if (!quote) return toast.error("Run quote first");
    if (!phantomAddr) return toast.error("Connect Phantom first");
    setBusy(true);
    try {
      const r = await api.post("/swap/jupiter/build", { quote_response: quote, user_public_key: phantomAddr });
      const swapTx = r.data?.swapTransaction;
      if (!swapTx) throw new Error("No tx returned");
      const tx = VersionedTransaction.deserialize(Uint8Array.from(atob(swapTx), c => c.charCodeAt(0)));
      const signed = await window.solana.signTransaction(tx);
      const conn = new Connection(RPC, "confirmed");
      const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      toast.success("TX submitted");
      window.open(`https://solscan.io/tx/${sig}`, "_blank", "noopener");
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || "Swap failed");
    } finally { setBusy(false); }
  };

  if (!coin) return null;

  if (!isSolana) {
    // ETH / multi-chain: hand off to 1inch
    const url = `https://app.1inch.io/#/1/simple/swap/USDC/${coin.symbol}`;
    return (
      <div className="p-4 text-xs text-[#8B949E] space-y-3">
        <div>Live swap on {coin.chain || "this chain"} requires an EVM-compatible aggregator.</div>
        <a href={url} target="_blank" rel="noopener noreferrer" data-testid="open-1inch-link" className="inline-flex items-center gap-2 border border-[#00FF66] text-[#00FF66] px-3 py-2 hover:bg-[#00FF66] hover:text-[#05050A] transition-colors">
          OPEN_1INCH <LinkSimple size={12}/>
        </a>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 text-xs">
      {!phantomAddr ? (
        <button onClick={connect} data-testid="liveswap-connect-phantom" className="w-full border border-[#00FF66] text-[#00FF66] py-2 hover:bg-[#00FF66] hover:text-[#05050A] transition-colors">
          CONNECT_PHANTOM
        </button>
      ) : (
        <div className="text-[#8B949E] truncate">WALLET: <span className="text-[#F8FAFC] font-mono">{phantomAddr.slice(0,6)}...{phantomAddr.slice(-4)}</span></div>
      )}
      <div className="grid grid-cols-2 gap-px bg-[#1A1A24]">
        <button onClick={()=>setSide("buy")} data-testid="liveswap-buy" className={`py-1.5 ${side==='buy'?'bg-[#00FF66] text-[#05050A]':'bg-[#0C0C12] text-[#8B949E]'}`}>BUY</button>
        <button onClick={()=>setSide("sell")} data-testid="liveswap-sell" className={`py-1.5 ${side==='sell'?'bg-[#FF3366] text-[#05050A]':'bg-[#0C0C12] text-[#8B949E]'}`}>SELL</button>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">{side === 'buy' ? 'AMOUNT_SOL' : `AMOUNT_${coin.symbol}`}</div>
        <input type="number" step="0.01" value={amountSol} onChange={e=>setAmountSol(e.target.value)} data-testid="liveswap-amount" className="mt-1 w-full bg-transparent border border-[#1A1A24] focus:border-[#00FF66] px-3 py-2 text-sm font-mono"/>
      </div>
      <button onClick={getQuote} disabled={busy} data-testid="liveswap-quote-btn" className="w-full border border-[#1A1A24] hover:border-[#00FF66] hover:text-[#00FF66] py-2 disabled:opacity-50">{busy?'QUOTING...':'GET_QUOTE'}</button>
      {quote && (
        <div className="border border-[#1A1A24] p-3 space-y-1 bg-[#05050A]" data-testid="liveswap-quote-result">
          <Row label="OUT" val={`${(quote.outAmount / (side==='buy' ? 1e5 : 1e9)).toFixed(4)} ${side==='buy' ? coin.symbol : 'SOL'}`}/>
          <Row label="IMPACT" val={`${(parseFloat(quote.priceImpactPct || 0) * 100).toFixed(3)}%`}/>
          <Row label="ROUTE" val={`${quote.routePlan?.length || 1} hops`}/>
        </div>
      )}
      <button onClick={execute} disabled={busy || !quote || !phantomAddr} data-testid="liveswap-execute-btn" className={`w-full py-2 font-display tracking-wider transition-colors disabled:opacity-50 ${side==='buy'?'border border-[#00FF66] bg-[#00FF66] text-[#05050A] hover:bg-transparent hover:text-[#00FF66]':'border border-[#FF3366] bg-[#FF3366] text-[#05050A] hover:bg-transparent hover:text-[#FF3366]'}`}>
        <Lightning size={12} className="inline mr-1"/>{busy?'SIGNING...':`EXEC_LIVE_${side.toUpperCase()}`}
      </button>
      <div className="text-[10px] text-[#8B949E] leading-relaxed">⚠ Real on-chain swap via Jupiter. Mainnet SOL gas applies. Transaction signs via Phantom.</div>
    </div>
  );
}

function Row({ label, val }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-[#8B949E]">{label}</span>
      <span className="text-[#F8FAFC] font-mono">{val}</span>
    </div>
  );
}
