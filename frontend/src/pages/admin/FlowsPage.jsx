import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function FlowsPage() {
  const [flows, setFlows] = useState([]);
  const [videos, setVideos] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ business_type: "wholesale", product_category: "textiles", modules: [], name: "", video_sequence: [], status: "active" });

  const load = () => Promise.all([api.get("/admin/flows"), api.get("/admin/videos2")]).then(([f,v])=>{ setFlows(f.data); setVideos(v.data); });
  useEffect(() => { load(); }, []);

  const toggleVid = (id) => setForm(f => ({...f, video_sequence: f.video_sequence.includes(id) ? f.video_sequence.filter(x=>x!==id) : [...f.video_sequence, id]}));
  const toggleMod = (m) => setForm(f => ({...f, modules: f.modules.includes(m) ? f.modules.filter(x=>x!==m) : [...f.modules, m]}));

  const save = async () => {
    try { await api.post("/admin/flows", form); toast.success("Flow created"); setShowNew(false); setForm({ ...form, name: "", modules: [], video_sequence: []}); load(); }
    catch(e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const del = async (id) => { if (!window.confirm("Delete?")) return; await api.delete(`/admin/flows/${id}`); load(); };

  const allMods = [...new Set(videos.map(v=>v.module_key))];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-black text-secondary">Combination Flows</h1>
        <Button data-testid="new-flow-btn" onClick={()=>setShowNew(true)} className="bg-orange-600 text-white rounded-full"><Plus className="h-4 w-4 mr-2" />New Flow</Button>
      </div>
      {showNew && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 grid gap-3">
          <input data-testid="flow-name" placeholder="Flow name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="border rounded-lg px-3 py-2" />
          <div className="grid grid-cols-2 gap-2">
            <input data-testid="flow-bt" placeholder="business_type key" value={form.business_type} onChange={e=>setForm({...form,business_type:e.target.value})} className="border rounded-lg px-3 py-2" />
            <input data-testid="flow-pc" placeholder="product_category key" value={form.product_category} onChange={e=>setForm({...form,product_category:e.target.value})} className="border rounded-lg px-3 py-2" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">Modules</div>
            <div className="flex flex-wrap gap-2">{allMods.map(m=><button key={m} onClick={()=>toggleMod(m)} className={`px-3 py-1 rounded-full text-xs border ${form.modules.includes(m)?"bg-orange-600 text-white border-orange-600":"bg-white border-slate-200"}`}>{m}</button>)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">Video sequence (click to add in order)</div>
            <div className="flex flex-wrap gap-2">{videos.map(v=><button key={v.id} onClick={()=>toggleVid(v.id)} className={`px-3 py-1 rounded-full text-xs border ${form.video_sequence.includes(v.id)?"bg-secondary text-white border-secondary":"bg-white border-slate-200"}`}>{form.video_sequence.indexOf(v.id)>=0 ? `${form.video_sequence.indexOf(v.id)+1}. ${v.title}` : v.title}</button>)}</div>
          </div>
          <div className="flex gap-2"><Button data-testid="save-flow" onClick={save} className="bg-orange-600 text-white">Create</Button><Button variant="ghost" onClick={()=>setShowNew(false)}>Cancel</Button></div>
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500"><tr><th className="text-left p-4">Name</th><th className="text-left p-4">BT</th><th className="text-left p-4">PC</th><th className="text-left p-4">Modules</th><th className="text-left p-4">Videos</th><th className="text-right p-4"></th></tr></thead>
          <tbody>
            {flows.map(f=>(
              <tr key={f.id} className="border-t border-slate-100">
                <td className="p-4 font-semibold">{f.name}</td>
                <td className="p-4">{f.business_type}</td>
                <td className="p-4">{f.product_category}</td>
                <td className="p-4 text-xs">{(f.modules||[]).join(", ")}</td>
                <td className="p-4">{(f.video_sequence||[]).length}</td>
                <td className="p-4 text-right"><Button size="sm" variant="ghost" onClick={()=>del(f.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
