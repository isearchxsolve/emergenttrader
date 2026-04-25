import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { ChartLine, Robot, Lightning, Receipt, Wallet, SignOut, GridFour } from "@phosphor-icons/react";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: "/dashboard", label: "DASHBOARD", icon: GridFour, testId: "nav-dashboard" },
    { to: "/bots", label: "BOTS", icon: Robot, testId: "nav-bots" },
    { to: "/signals", label: "AI_SIGNALS", icon: Lightning, testId: "nav-signals" },
    { to: "/trades", label: "TRADES", icon: Receipt, testId: "nav-trades" },
    { to: "/wallet", label: "WALLETS", icon: Wallet, testId: "nav-wallet" },
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#05050A] text-[#F8FAFC] font-mono flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-[#1A1A24] bg-[#0C0C12] flex flex-col">
        <div className="p-4 border-b border-[#1A1A24]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border border-[#00FF66] text-[#00FF66] flex items-center justify-center font-display text-xs">M$</div>
            <div className="font-display text-xs tracking-widest">MEMETRADE</div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-px">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} data-testid={l.testId} className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 text-xs uppercase tracking-[0.15em] border-l-2 ${isActive ? 'border-[#00FF66] bg-[#13131A] text-[#00FF66]' : 'border-transparent text-[#8B949E] hover:text-[#F8FAFC] hover:bg-[#13131A]'}`}>
              <l.icon size={16}/>{l.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-[#1A1A24]">
          <div className="text-[10px] text-[#8B949E] uppercase">Signed_in_as</div>
          <div className="text-xs truncate" data-testid="user-email">{user?.email}</div>
          <button onClick={handleLogout} data-testid="logout-btn" className="mt-3 w-full border border-[#1A1A24] hover:border-[#FF3366] hover:text-[#FF3366] py-2 text-xs flex items-center justify-center gap-2 transition-colors">
            <SignOut size={14}/> LOGOUT
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
