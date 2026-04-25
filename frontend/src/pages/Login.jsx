import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { GoogleLogo } from "@phosphor-icons/react";

export default function Login() {
  const { loginEmail } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await loginEmail(email, password);
      toast.success("Signed in.");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally { setBusy(false); }
  };

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-[#05050A] text-[#F8FAFC] font-mono flex items-center justify-center px-4 terminal-grid">
      <div className="w-full max-w-md border border-[#1A1A24] bg-[#0C0C12] p-8">
        <Link to="/" className="text-xs text-[#8B949E] hover:text-[#F8FAFC]">← BACK</Link>
        <div className="mt-6">
          <div className="text-xs uppercase tracking-[0.3em] text-[#00FF66]">[ AUTH ]</div>
          <h1 className="font-display text-2xl mt-2">SIGN_IN<span className="blink-cursor"/></h1>
        </div>

        <button onClick={googleLogin} data-testid="google-login-btn" className="mt-8 w-full border border-[#1A1A24] hover:border-[#00FF66] py-3 flex items-center justify-center gap-3 text-sm uppercase tracking-wider transition-colors">
          <GoogleLogo size={16} weight="bold"/> CONTINUE_WITH_GOOGLE
        </button>

        <div className="my-6 flex items-center gap-3 text-[10px] text-[#8B949E] uppercase tracking-[0.3em]">
          <div className="flex-1 h-px bg-[#1A1A24]"/>OR<div className="flex-1 h-px bg-[#1A1A24]"/>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">EMAIL</label>
            <input data-testid="login-email-input" required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full bg-transparent border border-[#1A1A24] focus:border-[#00FF66] px-3 py-2 text-sm"/>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">PASSWORD</label>
            <input data-testid="login-password-input" required type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full bg-transparent border border-[#1A1A24] focus:border-[#00FF66] px-3 py-2 text-sm"/>
          </div>
          <button data-testid="login-submit-btn" disabled={busy} className="w-full border border-[#00FF66] bg-[#00FF66] text-[#05050A] py-3 font-display text-sm tracking-wider disabled:opacity-50 hover:bg-transparent hover:text-[#00FF66] transition-colors">
            {busy ? "AUTHENTICATING..." : "SIGN_IN →"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-[#8B949E]">
          NO_ACCOUNT? <Link to="/register" data-testid="goto-register-link" className="text-[#00FF66] hover:underline">CREATE_ONE</Link>
        </div>
      </div>
    </div>
  );
}
