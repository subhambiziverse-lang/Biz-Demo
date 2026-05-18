import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, NavLink, useLocation } from "react-router-dom";
import api from "../../lib/api";
import { Video, Workflow, BookOpen, BarChart3, Settings, ListChecks, LogOut, LayoutDashboard, Map, HelpCircle, Cog, Globe, Menu, X } from "lucide-react";
import { Button } from "../../components/ui/button";

export default function AdminLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (window.location.hash.includes("session_id=")) { setChecking(false); return; }
    api.get("/auth/me").then(r => { setUser(r.data); setChecking(false); })
      .catch(() => { setChecking(false); nav("/admin/login"); });
  }, [nav]);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [loc.pathname]);

  const logout = async () => { try { await api.post("/auth/logout"); } catch(e) {} nav("/admin/login"); };

  if (checking) return <div className="min-h-screen grid place-items-center text-slate-500">Loading…</div>;
  if (!user) return null;

  const NAV = [
    { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
    { to: "/admin/videos", icon: Video, label: "Videos" },
    { to: "/admin/flows", icon: Workflow, label: "Demo Flows" },
    { to: "/admin/coverage", icon: Map, label: "Coverage" },
    { to: "/admin/kb", icon: BookOpen, label: "Knowledge Base" },
    { to: "/admin/unanswered", icon: HelpCircle, label: "Unanswered" },
    { to: "/admin/quiz-options", icon: ListChecks, label: "Quiz Options" },
    { to: "/admin/languages", icon: Globe, label: "Languages" },
    { to: "/admin/analytics", icon: BarChart3, label: "Analytics" },
    { to: "/admin/settings", icon: Cog, label: "Settings" },
    { to: "/admin/live-leads", icon: HelpCircle, label: "Live Leads" },
    { to: "/admin/users", icon: LayoutDashboard, label: "Users" },
  ];

  const SidebarBody = (
    <>
      <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="font-display font-black text-xl text-white">Biziverse</div>
          <div className="text-xs uppercase tracking-widest text-amber-300 font-bold">Admin</div>
        </div>
        <button
          data-testid="admin-drawer-close"
          onClick={() => setDrawerOpen(false)}
          className="lg:hidden text-slate-300 hover:text-white"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({isActive})=>`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${isActive?"bg-orange-600 text-white":"hover:bg-slate-800/60"}`}
            data-testid={`nav-${n.label.toLowerCase().replace(/\s/g,"-")}`}>
            <n.icon className="h-4 w-4" /> {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-800">
        <div className="px-3 py-2 text-xs text-slate-400 truncate">{user.email}</div>
        <Button data-testid="logout-btn" variant="ghost" size="sm" onClick={logout} className="w-full justify-start text-slate-300 hover:bg-slate-800/60 hover:text-white">
          <LogOut className="h-4 w-4 mr-2" /> Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 bg-secondary text-white flex items-center justify-between px-4 py-3 shadow">
        <div className="flex items-center gap-3">
          <button
            data-testid="admin-drawer-open"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="text-white hover:text-amber-300"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div>
            <div className="font-display font-black text-base leading-tight">Biziverse</div>
            <div className="text-[10px] uppercase tracking-widest text-amber-300 font-bold leading-tight">Admin</div>
          </div>
        </div>
        <Button onClick={logout} size="sm" variant="ghost" className="text-slate-200 hover:bg-slate-800/60 hover:text-white px-2">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setDrawerOpen(false)}
          data-testid="admin-drawer-backdrop"
        />
      )}

      {/* Sidebar — drawer on mobile, fixed on desktop */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-secondary text-slate-300 flex flex-col transform transition-transform duration-200
                    ${drawerOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
        data-testid="admin-sidebar"
      >
        {SidebarBody}
      </aside>

      <main className="flex-1 overflow-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
