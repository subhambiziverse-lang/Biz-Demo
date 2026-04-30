import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Plus, Edit, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

const MODULES = ["crm","quotes","sales_orders","sales_invoices","recovery","contracts","tickets","customers","accounts","purchases","purchase_orders","inventory","manufacturing","projects","tasks","suppliers","store","reports"];

export default function VideosPage() {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMod, setNewMod] = useState("crm");
  const [newUrl, setNewUrl] = useState("");

  const load = () => api.get("/admin/videos2").then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newTitle) return toast.error("Title required");
    try {
      const r = await api.post("/admin/videos", { module_key: newMod, title: newTitle, video_url: newUrl, markers: [], published: false });
      toast.success("Created");
      setShowNew(false); setNewTitle(""); setNewUrl("");
      load();
      nav(`/admin/videos/${r.data.id}`);
    } catch (e) { toast.error("Failed"); }
  };

  const del = async (id) => { if (!window.confirm("Delete?")) return; await api.delete(`/admin/videos/${id}`); load(); };

  const handleUpload = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const fd = new FormData(); fd.append("file", f);
    toast.info("Uploading…");
    try {
      const r = await api.post("/admin/upload", fd);
      setNewUrl(`${api.defaults.baseURL}/files/${r.data.storage_path}`);
      toast.success("Uploaded");
    } catch (err) { toast.error("Upload failed"); }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-black text-secondary">Module Videos</h1>
        <Button data-testid="new-video-btn" onClick={()=>setShowNew(true)} className="bg-orange-600 hover:bg-orange-700 text-white rounded-full"><Plus className="h-4 w-4 mr-2" />New Video</Button>
      </div>

      {showNew && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 grid gap-3">
          <input data-testid="new-vid-title" value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Video title" className="border border-slate-200 rounded-lg px-3 py-2" />
          <select data-testid="new-vid-module" value={newMod} onChange={e=>setNewMod(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2">
            {MODULES.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
          <div className="flex gap-2">
            <input data-testid="new-vid-url" value={newUrl} onChange={e=>setNewUrl(e.target.value)} placeholder="Video URL or upload" className="flex-1 border border-slate-200 rounded-lg px-3 py-2" />
            <label className="border border-slate-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-50 inline-flex items-center text-sm"><Upload className="h-4 w-4 mr-1" />Upload<input type="file" accept="video/*" onChange={handleUpload} className="hidden" /></label>
          </div>
          <div className="flex gap-2"><Button data-testid="save-new-vid" onClick={create} className="bg-orange-600 text-white">Create</Button><Button variant="ghost" onClick={()=>setShowNew(false)}>Cancel</Button></div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500"><tr><th className="text-left p-4">Title</th><th className="text-left p-4">Module</th><th className="text-left p-4">Markers</th><th className="text-left p-4">Status</th><th className="text-right p-4">Actions</th></tr></thead>
          <tbody>
            {items.map(v=>(
              <tr key={v.id} className="border-t border-slate-100">
                <td className="p-4 font-semibold text-secondary">{v.title}</td>
                <td className="p-4 text-slate-600">{v.module_key}</td>
                <td className="p-4">{(v.markers||[]).length}</td>
                <td className="p-4">{v.published ? <span className="text-emerald-600 font-bold">Published</span> : <span className="text-slate-400">Draft</span>}</td>
                <td className="p-4 text-right space-x-2">
                  <Button data-testid={`edit-vid-${v.id}`} size="sm" variant="outline" onClick={()=>nav(`/admin/videos/${v.id}`)}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button data-testid={`del-vid-${v.id}`} size="sm" variant="ghost" onClick={()=>del(v.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
