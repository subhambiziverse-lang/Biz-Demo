import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, NavLink } from "react-router-dom";
import api from "../../lib/api";
import { Video, Workflow, BookOpen, BarChart3, Settings, ListChecks, LogOut, LayoutDashboard, Map, HelpCircle, Cog, Globe } from "lucide-react";
import { Button } from "../../components/ui/button";

export default function AdminLayout() {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (window.location.hash.includes("session_id=")) { setChecking(false); return; }
    api.get("/auth/me").then(r => { setUser(r.data); setChecking(false); })
      .catch(() => { setChecking(false); nav("/admin/login"); });
  }, [nav]);

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
  ];

  return (
    <div className="min-h-screen flex bg-slate-100">
      <aside className="w-64 bg-secondary text-slate-300 flex flex-col">
        <div className="px-6 py-5 border-b border-slate-800">
          <div className="font-display font-black text-xl text-white">Biziverse</div>
          <div className="text-xs uppercase tracking-widest text-amber-300 font-bold">Admin</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({isActive})=>`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${isActive?"bg-orange-600 text-white":"hover:bg-slate-800/60"}`}
              data-testid={`nav-${n.label.toLowerCase().replace(/\s/g,"-")}`}>
              <n.icon className="h-4 w-4" /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <div className="px-3 py-2 text-xs text-slate-400">{user.email}</div>
          <Button data-testid="logout-btn" variant="ghost" size="sm" onClick={logout} className="w-full justify-start text-slate-300 hover:bg-slate-800/60 hover:text-white">
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
