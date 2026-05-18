import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { Activity, Clock, Archive } from "lucide-react";

const TABS = [
  { key: "live",    label: "Live",     icon: Activity, statuses: ["assigned", "active", "in_session"] },
  { key: "queue",   label: "In Queue", icon: Clock,    statuses: ["pending"] },
  { key: "history", label: "History",  icon: Archive,  statuses: ["closed", "completed", "resolved"] },
];

function statusBadge(status) {
  const s = (status || "pending").toLowerCase();
  const map = {
    pending:   "bg-amber-100 text-amber-700",
    assigned:  "bg-emerald-100 text-emerald-700",
    active:    "bg-emerald-100 text-emerald-700",
    in_session:"bg-emerald-100 text-emerald-700",
    closed:    "bg-slate-200 text-slate-600",
    completed: "bg-slate-200 text-slate-600",
    resolved:  "bg-slate-200 text-slate-600",
  };
  return map[s] || "bg-slate-100 text-slate-600";
}

export default function LiveLeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("live");
  const [selected, setSelected] = useState(new Set());
  const nav = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/live-leads");
      setLeads(res.data || []);
    } catch (err) {
      toast.error("Unable to load live leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { setSelected(new Set()); }, [tab]);

  const counts = useMemo(() => {
    const c = { live: 0, queue: 0, history: 0 };
    for (const l of leads) {
      const s = (l.status || "pending").toLowerCase();
      if (TABS[0].statuses.includes(s)) c.live++;
      else if (TABS[1].statuses.includes(s)) c.queue++;
      else if (TABS[2].statuses.includes(s)) c.history++;
      else c.queue++;
    }
    return c;
  }, [leads]);

  const filtered = useMemo(() => {
    const cur = TABS.find(t => t.key === tab);
    if (!cur) return leads;
    return leads.filter(l => {
      const s = (l.status || "pending").toLowerCase();
      if (cur.key === "queue" && !TABS.flatMap(t => t.statuses).includes(s)) return true;
      return cur.statuses.includes(s);
    });
  }, [leads, tab]);

  const assignSelf = async (id) => {
    try {
      const res = await api.post(`/admin/live-leads/${id}/assign`);
      toast.success("Assigned. Opening chat…");
      await load();
      setTab("live");
      nav(`/admin/live-leads/${res.data?.lead?.id || id}`);
    } catch (err) {
      toast.error("Failed to assign live lead");
    }
  };

  const openChat = (id) => nav(`/admin/live-leads/${id}`);

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/admin/live-leads/${id}`, { status });
      toast.success(`Status: ${status}`);
      load();
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(l => l.id)));
  };

  const bulkDelete = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} chat record(s)? This cannot be undone.`)) return;
    try {
      await api.delete("/admin/live-leads/bulk", { data: { ids: [...selected] } });
      toast.success(`Deleted ${selected.size} records`);
      setSelected(new Set());
      load();
    } catch (err) {
      toast.error("Bulk delete failed");
    }
  };

  return (
    <div className="p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-black text-secondary">Live Leads</h1>
          <p className="text-slate-500 text-sm">Monitor chat requests and assign leads for follow-up.</p>
        </div>
        <Button data-testid="refresh-leads" variant="outline" onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit mb-6">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              data-testid={`tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-mono ${active ? "bg-orange-100 text-orange-700" : "bg-slate-200 text-slate-500"}`}>{counts[t.key]}</span>
            </button>
          );
        })}
      </div>

      {/* Bulk delete bar — history only */}
      {tab === "history" && filtered.length > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-2xl border border-slate-200">
          <input
            type="checkbox"
            data-testid="select-all-checkbox"
            checked={selected.size === filtered.length && filtered.length > 0}
            onChange={selectAll}
            className="h-4 w-4 rounded accent-orange-600 cursor-pointer"
          />
          <span className="text-sm text-slate-600">
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </span>
          {selected.size > 0 && (
            <button
              data-testid="bulk-delete-btn"
              onClick={bulkDelete}
              className="ml-auto px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
            >
              Delete {selected.size} record{selected.size > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-sm text-slate-500 rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
          {tab === "live" && "No active conversations right now."}
          {tab === "queue" && "Queue is empty. New requests will appear here when users ask for a human."}
          {tab === "history" && "No closed leads yet."}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((lead) => (
            <div
              key={lead.id}
              data-testid={`lead-${lead.id}`}
              className={`bg-white border rounded-3xl p-6 shadow-sm hover:border-orange-300 transition-colors ${selected.has(lead.id) ? "border-orange-400 bg-orange-50/30" : "border-slate-200"}`}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                {tab === "history" && (
                  <div className="flex items-start pt-1">
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                      className="h-4 w-4 rounded accent-orange-600 cursor-pointer"
                    />
                  </div>
                )}
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2 items-center text-sm text-slate-500">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadge(lead.status)}`}>{lead.status || "pending"}</span>
                    <span className="font-mono text-xs text-slate-400">#{lead.id.slice(-8)}</span>
                    <span className="font-semibold text-slate-700">{lead.phone}</span>
                    {lead.business_type && <span className="text-xs text-slate-500">· {lead.business_type}</span>}
                    {lead.product_category && <span className="text-xs text-slate-500">· {lead.product_category}</span>}
                    {lead.assigned_to && <span className="text-xs text-slate-500">· <span className="font-medium text-slate-700">{lead.assigned_to}</span></span>}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-xs uppercase tracking-widest text-slate-400">Callback time</div>
                      <div className="mt-1 text-sm text-slate-700">{lead.callback_time ? new Date(lead.callback_time).toLocaleString() : "Not scheduled"}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-xs uppercase tracking-widest text-slate-400">Request type</div>
                      <div className="mt-1 text-sm text-slate-700">{lead.human_now ? "Immediate" : "Scheduled"} · {lead.voice_requested ? "Voice" : "Text"}</div>
                    </div>
                  </div>
                  {(lead.modules_watched?.length || lead.questions_asked?.length) ? (
                    <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
                      {lead.modules_watched?.length > 0 && <div>• Modules: <span className="text-slate-700 font-medium">{lead.modules_watched.slice(0, 4).join(", ")}{lead.modules_watched.length > 4 ? "…" : ""}</span></div>}
                      {lead.questions_asked?.length > 0 && <div className="mt-1">• Questions: <span className="text-slate-700 font-medium">{lead.questions_asked.slice(0, 3).join("; ")}{lead.questions_asked.length > 3 ? "…" : ""}</span></div>}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 md:items-end">
                  {tab === "queue" && <Button data-testid={`assign-${lead.id}`} size="sm" onClick={() => assignSelf(lead.id)} className="bg-orange-600 hover:bg-orange-700 text-white">Assign to me</Button>}
                  {tab === "live" && <Button data-testid={`open-${lead.id}`} size="sm" onClick={() => openChat(lead.id)} className="bg-orange-600 hover:bg-orange-700 text-white">Open chat</Button>}
                  {tab === "history" && <Button data-testid={`view-${lead.id}`} size="sm" variant="outline" onClick={() => openChat(lead.id)}>View chat</Button>}
                  {tab !== "history" && <Button data-testid={`close-${lead.id}`} size="sm" variant="outline" onClick={() => updateStatus(lead.id, "closed")}>Close lead</Button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
