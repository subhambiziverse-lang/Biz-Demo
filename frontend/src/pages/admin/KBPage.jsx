import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const LANGS = ["en","hi","gu","mr"];

export default function KBPage() {
  const [items, setItems] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ question: "", answers: { en: "" }, tags: "", active: true, video_url: "", video_start: "", video_end: "" });
  const [filter, setFilter] = useState("");

  const load = () => api.get("/admin/kb").then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const payload = {
        question: form.question,
        answers: form.answers,
        tags: form.tags.split(",").map(s=>s.trim()).filter(Boolean),
        active: true,
        video_url: form.video_url || null,
        video_start: form.video_start ? parseFloat(form.video_start) : null,
        video_end: form.video_end ? parseFloat(form.video_end) : null,
      };
      await api.post("/admin/kb", payload);
      toast.success("Saved"); setShowNew(false);
      setForm({question:"",answers:{en:""},tags:"",active:true,video_url:"",video_start:"",video_end:""}); load();
    } catch(e) { toast.error("Failed"); }
  };
  const del = async (id) => { if(!window.confirm("Delete?"))return; await api.delete(`/admin/kb/${id}`); load(); };
  const toggleActive = async (item) => { await api.put(`/admin/kb/${item.id}`, {...item, active: !item.active}); load(); };

  const filtered = items.filter(i => !filter || i.question.toLowerCase().includes(filter.toLowerCase()) || (i.tags||[]).some(t=>t.includes(filter)));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-black text-secondary">Knowledge Base</h1>
        <Button data-testid="new-kb" onClick={()=>setShowNew(true)} className="bg-orange-600 text-white rounded-full"><Plus className="h-4 w-4 mr-2" />New Entry</Button>
      </div>
      <input data-testid="kb-filter" placeholder="Filter by question or tag…" value={filter} onChange={e=>setFilter(e.target.value)} className="w-full mb-4 border border-slate-200 rounded-lg px-3 py-2" />
      {showNew && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 grid gap-3">
          <input data-testid="kb-question" placeholder="Question" value={form.question} onChange={e=>setForm({...form,question:e.target.value})} className="border rounded-lg px-3 py-2" />
          {LANGS.map(l=>(<textarea key={l} placeholder={`${l}: answer`} value={form.answers[l]||""} onChange={e=>setForm({...form, answers: {...form.answers, [l]: e.target.value}})} rows={2} className="border rounded-lg px-3 py-2 text-sm" />))}
          <input placeholder="tags (comma separated)" value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} className="border rounded-lg px-3 py-2" />
          <div className="border-t pt-3">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">Optional: "Show me" video</div>
            <input data-testid="kb-video-url" placeholder="YouTube URL or video URL (leave empty for text-only answer)" value={form.video_url} onChange={e=>setForm({...form,video_url:e.target.value})} className="w-full border rounded-lg px-3 py-2 mb-2 text-sm font-mono" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" step="0.1" placeholder="Start (seconds)" value={form.video_start} onChange={e=>setForm({...form,video_start:e.target.value})} className="border rounded-lg px-3 py-2 text-sm font-mono" />
              <input type="number" step="0.1" placeholder="End (seconds)" value={form.video_end} onChange={e=>setForm({...form,video_end:e.target.value})} className="border rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
          </div>
          <div className="flex gap-2"><Button data-testid="save-kb" onClick={save} className="bg-orange-600 text-white">Save</Button><Button variant="ghost" onClick={()=>setShowNew(false)}>Cancel</Button></div>
        </div>
      )}
      <div className="space-y-3">
        {filtered.map(k=>(
          <div key={k.id} className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-display font-bold text-secondary">{k.question}</div>
                <div className="text-sm text-slate-600 mt-2">{k.answers?.en}</div>
                {k.video_url && <div className="text-xs text-orange-600 font-bold mt-1">▶ "Show me" video: {k.video_url.slice(0,60)}…{k.video_start ? ` [${k.video_start}s — ${k.video_end||'end'}s]` : ""}</div>}
                <div className="flex gap-1 mt-2 flex-wrap">{(k.tags||[]).map((t,i)=><span key={i} className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">{t}</span>)}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={()=>toggleActive(k)}>{k.active?"Active":"Inactive"}</Button>
                <Button size="sm" variant="ghost" onClick={()=>del(k.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
