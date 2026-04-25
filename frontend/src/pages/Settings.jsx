import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle, Bell } from "@phosphor-icons/react";

export default function Settings() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [alertOnTrade, setAlertOnTrade] = useState(true);
  const [alertOnSignal, setAlertOnSignal] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api.get("/settings").then(r => {
      setWebhookUrl(r.data.webhook_url || "");
      setAlertOnTrade(r.data.alert_on_trade ?? true);
      setAlertOnSignal(r.data.alert_on_signal ?? true);
    });
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await api.post("/settings", { webhook_url: webhookUrl || null, alert_on_trade: alertOnTrade, alert_on_signal: alertOnSignal });
      toast.success("Settings saved");
    } catch { toast.error("Save failed"); }
    finally { setBusy(false); }
  };

  const testHook = async () => {
    setTesting(true);
    try {
      const r = await api.post("/settings/test-webhook");
      if (r.data.ok) toast.success(`Webhook OK (HTTP ${r.data.status})`);
      else toast.error(`Webhook failed: ${r.data.error || r.data.status}`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Webhook test failed"); }
    finally { setTesting(false); }
  };

  return (
    <div className="p-6 space-y-px max-w-3xl">
      <div className="pb-4">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#00FF66]">[ SETTINGS ]</div>
        <h1 className="font-display text-2xl mt-1">ALERTS_&_INTEGRATIONS</h1>
      </div>

      <div className="border border-[#1A1A24] bg-[#0C0C12]">
        <div className="px-4 py-3 border-b border-[#1A1A24] text-[10px] uppercase tracking-[0.3em] text-[#00FF66] flex items-center gap-2"><Bell size={14}/>[ WEBHOOK_ALERTS ]</div>
        <div className="p-6 space-y-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E] mb-1">WEBHOOK_URL</div>
            <input value={webhookUrl} onChange={e=>setWebhookUrl(e.target.value)} data-testid="webhook-url-input" placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/..."
              className="w-full bg-transparent border border-[#1A1A24] focus:border-[#00FF66] px-3 py-2 text-sm font-mono"/>
            <div className="text-[10px] text-[#8B949E] mt-2">Discord & Slack are auto-formatted. Other endpoints receive raw JSON.</div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-3 text-xs cursor-pointer">
              <input type="checkbox" checked={alertOnTrade} onChange={e=>setAlertOnTrade(e.target.checked)} data-testid="alert-on-trade-toggle" className="accent-[#00FF66]"/>
              ALERT_ON_TRADE_EXEC
            </label>
            <label className="flex items-center gap-3 text-xs cursor-pointer">
              <input type="checkbox" checked={alertOnSignal} onChange={e=>setAlertOnSignal(e.target.checked)} data-testid="alert-on-signal-toggle" className="accent-[#00FF66]"/>
              ALERT_ON_AI_SIGNAL
            </label>
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={busy} data-testid="save-settings-btn" className="border border-[#00FF66] bg-[#00FF66] text-[#05050A] px-5 py-2 font-display text-xs tracking-wider hover:bg-transparent hover:text-[#00FF66] disabled:opacity-50">{busy?'SAVING...':'SAVE'}</button>
            <button onClick={testHook} disabled={testing || !webhookUrl} data-testid="test-webhook-btn" className="border border-[#1A1A24] hover:border-[#FFB800] hover:text-[#FFB800] px-5 py-2 text-xs disabled:opacity-50 flex items-center gap-2"><CheckCircle size={14}/>{testing?'PINGING...':'SEND_TEST'}</button>
          </div>
        </div>
      </div>

      <div className="border border-[#1A1A24] bg-[#0C0C12] mt-px">
        <div className="px-4 py-3 border-b border-[#1A1A24] text-[10px] uppercase tracking-[0.3em] text-[#00FF66]">[ HELP ]</div>
        <div className="p-6 text-xs text-[#8B949E] space-y-3 leading-relaxed">
          <div>• <span className="text-[#F8FAFC]">Discord:</span> Server Settings → Integrations → Webhooks → Copy URL.</div>
          <div>• <span className="text-[#F8FAFC]">Slack:</span> https://api.slack.com/apps → Incoming Webhooks.</div>
          <div>• <span className="text-[#F8FAFC]">Generic:</span> any HTTPS endpoint that accepts a POST with JSON body.</div>
        </div>
      </div>
    </div>
  );
}
