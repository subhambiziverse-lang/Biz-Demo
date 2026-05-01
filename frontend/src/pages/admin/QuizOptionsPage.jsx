import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Plus, Trash2, Save, Code } from "lucide-react";
import { toast } from "sonner";

const MODULES = ["crm","quotes","sales_orders","sales_invoices","recovery","contracts","tickets","customers","accounts","purchases","purchase_orders","inventory","manufacturing","projects","tasks","suppliers","store","reports"];

export default function QuizOptionsPage() {
  const [cfg, setCfg] = useState(null);
  const [rawMode, setRawMode] = useState(false);
  const [raw, setRaw] = useState("");

  useEffect(() => {
    api.get("/admin/quiz-options").then(r => { setCfg(r.data); setRaw(JSON.stringify(r.data, null, 2)); });
  }, []);

  const save = async () => {
    try {
      const data = rawMode ? JSON.parse(raw) : cfg;
      await api.put("/admin/quiz-options", data);
      toast.success("Saved");
      if (!rawMode) setRaw(JSON.stringify(data, null, 2));
    } catch(e) { toast.error("Invalid JSON or save failed"); }
  };

  if (!cfg) return <div className="p-8">Loading…</div>;

  const addBusinessType = () => {
    const key = prompt("Key (e.g. 'new_type'):"); if (!key) return;
    const label = prompt("English label:"); if (!label) return;
    setCfg({...cfg, business_types: [...cfg.business_types, { key, label: { en: label } }], product_categories: { ...cfg.product_categories, [key]: [] }});
  };
  const delBusinessType = (key) => setCfg({...cfg, business_types: cfg.business_types.filter(b=>b.key!==key)});

  const addPC = (btKey) => {
    const key = prompt("Key:"); if (!key) return;
    const label = prompt("English label:"); if (!label) return;
    setCfg({...cfg, product_categories: { ...cfg.product_categories, [btKey]: [...(cfg.product_categories[btKey]||[]), { key, label: { en: label } }] }});
  };
  const delPC = (btKey, pcKey) => setCfg({...cfg, product_categories: { ...cfg.product_categories, [btKey]: cfg.product_categories[btKey].filter(p=>p.key!==pcKey) }});

  const toggleModule = (btKey, pcKey, mod) => {
    const segKey = `${btKey}|${pcKey}`;
    const current = cfg.modules?.[segKey] || cfg.modules?._default || MODULES;
    const next = current.includes(mod) ? current.filter(m=>m!==mod) : [...current, mod];
    setCfg({...cfg, modules: { ...(cfg.modules||{}), [segKey]: next }});
  };

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-black text-secondary">Quiz Options</h1>
          <p className="text-slate-500 text-sm">Manage Q1 business types, Q2 product categories, and which modules are available in Q3 per segment.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={()=>setRawMode(m=>!m)}><Code className="h-4 w-4 mr-2" />{rawMode?"Visual":"JSON"}</Button>
          <Button data-testid="save-quiz-cfg" onClick={save} className="bg-orange-600 hover:bg-orange-700 text-white"><Save className="h-4 w-4 mr-2" />Save</Button>
        </div>
      </div>

      {rawMode ? (
        <textarea data-testid="quiz-json" value={raw} onChange={e=>setRaw(e.target.value)} rows={28} className="w-full font-mono text-xs border border-slate-200 rounded-2xl p-4" />
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="font-display font-bold text-lg text-secondary">Business Types (Q1)</div>
            <Button size="sm" onClick={addBusinessType} className="bg-orange-600 text-white"><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
          </div>
          <div className="grid gap-3">
            {cfg.business_types.map(bt => (
              <details key={bt.key} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <summary className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50">
                  <div>
                    <div className="font-display font-bold text-secondary">{bt.label?.en}</div>
                    <div className="text-xs text-slate-500 font-mono">{bt.key}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{(cfg.product_categories[bt.key]||[]).length} products</span>
                    <button onClick={(e)=>{e.preventDefault(); delBusinessType(bt.key);}} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </summary>
                <div className="p-4 border-t border-slate-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">Product Categories (Q2)</div>
                    <Button size="sm" variant="outline" onClick={()=>addPC(bt.key)}><Plus className="h-3 w-3 mr-1" />Product</Button>
                  </div>
                  {(cfg.product_categories[bt.key]||[]).map(pc => {
                    const segKey = `${bt.key}|${pc.key}`;
                    const enabled = cfg.modules?.[segKey] || cfg.modules?._default || MODULES;
                    return (
                      <div key={pc.key} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-bold text-secondary text-sm">{pc.label?.en}</div>
                            <div className="text-xs text-slate-400 font-mono">{pc.key}</div>
                          </div>
                          <button onClick={()=>delPC(bt.key, pc.key)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                        <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mt-3 mb-1.5">Q3 Modules available for this segment:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {MODULES.map(m => (
                            <button key={m} onClick={()=>toggleModule(bt.key, pc.key, m)}
                              className={`text-[10px] px-2 py-1 rounded-full font-bold transition-colors ${enabled.includes(m) ? "bg-orange-600 text-white" : "bg-white border border-slate-300 text-slate-500 hover:border-orange-300"}`}>
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
