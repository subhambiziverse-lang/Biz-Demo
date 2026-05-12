import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Check, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function UnansweredPage() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("unresolved");

  const load = () => api.get("/admin/unanswered").then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const resolve = async (qid) => { await api.post(`/admin/unanswered/${qid}/resolve`); toast.success("Marked resolved"); load(); };
  const del = async (qid) => { await api.delete(`/admin/unanswered/${qid}`); load(); };

  const filtered = items.filter(i => filter === "all" ? true : !i.resolved);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-black text-secondary">Unanswered Questions</h1>
          <p className="text-slate-500 text-sm">Questions users asked that aren't in the Knowledge Base. Add them to KB to improve AI answers.</p>
        </div>
        <select value={filter} onChange={e=>setFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="unresolved">Unresolved</option>
          <option value="all">All</option>
        </select>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && <div className="text-sm text-slate-400 text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">No unanswered questions{filter==="unresolved"?" — all caught up!":""}.</div>}
        {filtered.map(q => (
          <div key={q.id} className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-orange-100 grid place-items-center flex-shrink-0"><MessageSquare className="h-4 w-4 text-orange-600" /></div>
              <div className="flex-1">
                <div className="font-display font-bold text-secondary">{q.question}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {new Date(q.created_at).toLocaleString()} · {q.language} · {q.business_type || "—"} · {q.product_category || "—"}
                </div>
                {q.resolved && <span className="inline-block mt-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Resolved</span>}
              </div>
              <div className="flex gap-1">
                {!q.resolved && <Button size="sm" variant="outline" onClick={()=>resolve(q.id)}><Check className="h-3.5 w-3.5" /></Button>}
                <Button size="sm" variant="ghost" onClick={()=>del(q.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
