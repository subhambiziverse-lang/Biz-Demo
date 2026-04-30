import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";

export default function QuizOptionsPage() {
  const [cfg, setCfg] = useState(null);
  const [raw, setRaw] = useState("");
  useEffect(() => { api.get("/admin/quiz-options").then(r => { setCfg(r.data); setRaw(JSON.stringify(r.data, null, 2)); }); }, []);
  const save = async () => {
    try { const parsed = JSON.parse(raw); await api.put("/admin/quiz-options", parsed); toast.success("Saved"); }
    catch(e) { toast.error("Invalid JSON or save failed"); }
  };
  return (
    <div className="p-8">
      <h1 className="font-display text-3xl font-black text-secondary mb-2">Quiz Options</h1>
      <p className="text-slate-500 text-sm mb-4">Edit business types, product categories, and module availability per segment (advanced JSON editor).</p>
      <textarea data-testid="quiz-json" value={raw} onChange={e=>setRaw(e.target.value)} rows={28} className="w-full font-mono text-xs border border-slate-200 rounded-2xl p-4" />
      <Button data-testid="save-quiz-cfg" onClick={save} className="mt-3 bg-orange-600 text-white">Save Configuration</Button>
    </div>
  );
}
