import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function MiniDemosPage() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const load = () => api.get("/admin/mini-demos").then(r=>setItems(r.data));
  useEffect(()=>{load();}, []);
  const create = async () => { if(!name) return; await api.post("/admin/mini-demos", {name, steps:[]}); toast.success("Created"); setName(""); load(); };
  const del = async (id) => { await api.delete(`/admin/mini-demos/${id}`); load(); };
  return (
    <div className="p-8">
      <h1 className="font-display text-3xl font-black text-secondary mb-6">Mini-Demo Scripts</h1>
      <div className="bg-white border rounded-2xl p-4 flex gap-2 mb-4">
        <input data-testid="mini-name" value={name} onChange={e=>setName(e.target.value)} placeholder="Mini-demo name" className="flex-1 border rounded-lg px-3 py-2" />
        <Button data-testid="add-mini" onClick={create} className="bg-orange-600 text-white"><Plus className="h-4 w-4 mr-2" />Add</Button>
      </div>
      <div className="grid gap-2">
        {items.map(m=>(
          <div key={m.id} className="bg-white border rounded-xl p-4 flex items-center justify-between">
            <div className="font-semibold">{m.name}</div>
            <Button size="sm" variant="ghost" onClick={()=>del(m.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
