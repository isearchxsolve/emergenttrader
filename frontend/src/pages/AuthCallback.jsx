import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    const hash = window.location.hash;
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) { navigate("/login"); return; }
    const sid = m[1];
    (async () => {
      try {
        const r = await api.post("/auth/google/session", { session_id: sid });
        if (r.data?.session_token) localStorage.setItem("token", r.data.session_token);
        setUser(r.data.user);
        // Clean hash
        window.history.replaceState({}, "", window.location.pathname);
        navigate("/dashboard", { state: { user: r.data.user } });
      } catch (e) {
        console.error(e);
        navigate("/login");
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05050A] text-[#00FF66] font-mono">
      <div data-testid="auth-callback-status">EXCHANGING_SESSION<span className="blink-cursor"/></div>
    </div>
  );
}
