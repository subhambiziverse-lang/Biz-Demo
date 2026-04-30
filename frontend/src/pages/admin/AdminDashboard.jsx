import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Video, BookOpen, Workflow, BarChart3 } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ videos: 0, flows: 0, kb: 0, sessions: 0 });
  useEffect(() => {
    Promise.all([
      api.get("/admin/videos2").catch(() => ({ data: [] })),
      api.get("/admin/flows").catch(() => ({ data: [] })),
      api.get("/admin/kb").catch(() => ({ data: [] })),
      api.get("/admin/analytics/sessions").catch(() => ({ data: [] }))
    ]).then(([v, f, k, s]) => setStats({ videos: v.data.length, flows: f.data.length, kb: k.data.length, sessions: s.data.length }));
  }, []);

  const cards = [
    { i: Video, l: "Module Videos", v: stats.videos, c: "text-orange-600 bg-orange-50" },
    { i: Workflow, l: "Demo Flows", v: stats.flows, c: "text-blue-600 bg-blue-50" },
    { i: BookOpen, l: "KB Entries", v: stats.kb, c: "text-emerald-600 bg-emerald-50" },
    { i: BarChart3, l: "Sessions", v: stats.sessions, c: "text-amber-600 bg-amber-50" },
  ];

  return (
    <div className="p-8">
      <h1 className="font-display text-3xl font-black text-secondary">Welcome back</h1>
      <p className="text-slate-500 text-sm">Manage demo content, videos, knowledge base and analytics.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {cards.map((c,i)=>(
          <div key={i} data-testid={`stat-${c.l.toLowerCase().replace(/\s/g,"-")}`} className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className={`h-10 w-10 rounded-xl grid place-items-center ${c.c}`}><c.i className="h-5 w-5" /></div>
            <div className="text-xs uppercase tracking-widest text-slate-500 mt-4 font-bold">{c.l}</div>
            <div className="font-display text-3xl font-black text-secondary">{c.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
