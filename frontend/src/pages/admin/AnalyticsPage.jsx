import React, { useEffect, useState } from "react";
import api from "../../lib/api";

export default function AnalyticsPage() {
  const [data, setData] = useState({ funnel: [], popular_flows: [] });
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get("/admin/analytics/funnel").then(r => setData(r.data)).catch(e=>console.error("funnel", e));
    api.get("/admin/analytics/sessions").then(r => setSessions(r.data)).catch(e=>console.error("sessions", e));
  }, []);

  const top = data.funnel[0]?.count || 1;

  const openSession = async (sid) => {
    const r = await api.get(`/admin/analytics/sessions/${sid}`);
    setSelected(r.data);
  };

  return (
    <div className="p-8">
      <h1 className="font-display text-3xl font-black text-secondary mb-6">Analytics</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="font-display font-bold text-lg text-secondary mb-4">Funnel</div>
          <div className="space-y-3">
            {data.funnel.map((f,i)=>(
              <div key={i}>
                <div className="flex justify-between text-sm"><span>{f.stage}</span><span className="font-bold">{f.count}</span></div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-1"><div className="h-full bg-orange-500" style={{width: `${(f.count/top)*100}%`}} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="font-display font-bold text-lg text-secondary mb-4">Popular Combinations</div>
          <div className="space-y-2">
            {data.popular_flows.map((p,i)=>(
              <div key={i} className="flex justify-between text-sm border-b border-slate-100 py-2">
                <span>{p.business_type} · {p.product_category}</span>
                <span className="font-bold">{p.count}</span>
              </div>
            ))}
            {data.popular_flows.length === 0 && <div className="text-xs text-slate-400">No data yet.</div>}
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-6">
        <div className="font-display font-bold text-lg text-secondary mb-4">Recent Sessions</div>
        <div className="grid lg:grid-cols-3 gap-2">
          {sessions.slice(0,30).map(s=>(
            <button key={s.session_id} onClick={()=>openSession(s.session_id)} className="text-left bg-slate-50 hover:bg-orange-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
              <div className="font-mono">{s.session_id.slice(0,16)}…</div>
              <div className="text-slate-500">{s.business_type || "—"} · {(s.modules||[]).length} modules</div>
            </button>
          ))}
        </div>
        {selected && (
          <div className="mt-6 border-t pt-4">
            <div className="font-display font-bold mb-2">Session {selected.session?.session_id}</div>
            <div className="space-y-1 max-h-72 overflow-y-auto thin-scroll">
              {selected.events.map((e,i)=>(<div key={i} className="text-xs flex gap-3 border-b border-slate-100 py-1.5"><span className="text-slate-400 w-32">{e.created_at?.slice(11,19)}</span><span className="font-semibold w-48">{e.event_type}</span><span className="text-slate-500">{JSON.stringify(e.payload)}</span></div>))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
