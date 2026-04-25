import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AuthCallback from "@/pages/AuthCallback";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import CoinDetail from "@/pages/CoinDetail";
import Bots from "@/pages/Bots";
import Trades from "@/pages/Trades";
import Signals from "@/pages/Signals";
import Wallet from "@/pages/Wallet";
import Settings from "@/pages/Settings";
import "@/App.css";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-[#00FF66] font-mono text-sm">AUTHENTICATING<span className="blink-cursor"/></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/coin/:coinId" element={<CoinDetail />} />
        <Route path="/coins/:coinId" element={<CoinDetail />} />
        <Route path="/bots" element={<Bots />} />
        <Route path="/trades" element={<Trades />} />
        <Route path="/signals" element={<Signals />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
          <Toaster theme="dark" position="bottom-right" toastOptions={{ style: { background: '#0C0C12', border: '1px solid #1A1A24', borderRadius: 0, fontFamily: 'IBM Plex Mono' } }} />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
