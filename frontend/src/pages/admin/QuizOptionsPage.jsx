import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Plus, Trash2, Save, Code, Tag } from "lucide-react";
import { toast } from "sonner";

const MODULES = ["crm","quotes","sales_orders","sales_invoices","recovery","contracts","tickets","customers","accounts","purchases","purchase_orders","inventory","manufacturing","projects","tasks","suppliers","store","reports"];

export default function QuizOptionsPage() {
  const [cfg, setCfg] = useState(null);
  const [rawMode, setRawMode] = useState(false);
  const [raw, setRaw] = useState("");
  const [languages, setLanguages] = useState([]);
  const [moduleLabels, setModuleLabels] = useState({});
  const [showLabelsFor, setShowLabelsFor] = useState(null);

  // Load all three: quiz cfg + languages + module labels
  const loadAll = async () => {
    const [qc, lg, ml] = await Promise.all([
      api.get("/admin/quiz-options"),
      api.get("/languages"),
      api.get("/admin/module-labels"),
    ]);
    setCfg(qc.data);
    setRaw(JSON.stringify(qc.data, null, 2));
    setLanguages(lg.data.languages || []);
    setModuleLabels(ml.data.labels || {});
  };

  useEffect(() => { loadAll(); }, []);

  // Keep raw and cfg in sync when toggling mode
  const switchMode = (toRaw) => {
    if (toRaw) {
      // Visual -> JSON: dump current cfg into raw
      setRaw(JSON.stringify(cfg, null, 2));
      setRawMode(true);
    } else {
      // JSON -> Visual: parse raw back into cfg
      try {
        const parsed = JSON.parse(raw);
        setCfg(parsed);
        setRawMode(false);
      } catch (e) {
        toast.error("Invalid JSON — fix it before switching to Visual");
      }
    }
  };

  const save = async () => {
    try {
      let data;
      if (rawMode) {
        data = JSON.parse(raw);
        setCfg(data); // KEEP cfg in sync so Visual mode reflects edits
      } else {
        data = cfg;
        setRaw(JSON.stringify(cfg, null, 2));
      }
      await api.put("/admin/quiz-options", data);
      toast.success("Saved — changes are live in the demo");
    } catch (e) {
      toast.error("Invalid JSON or save failed");
    }
  };

  const saveModuleLabels = async () => {
    try {
      await api.put("/admin/module-labels", { labels: moduleLabels });
      toast.success("Module labels saved");
    } catch (e) { toast.error("Save failed"); }
  };

  if (!cfg) return <div className="p-8">Loading…</div>;

  const langCodes = languages.map(l => l.code);

  const addBusinessType = () => {
    const key = prompt("Key (e.g. 'new_type'):"); if (!key) return;
    const label = prompt("English label:"); if (!label) return;
    setCfg({...cfg, business_types: [...cfg.business_types, { key, label: { en: label } }], product_categories: { ...cfg.product_categories, [key]: [] }});
  };
  const delBusinessType = (key) => setCfg({...cfg, business_types: cfg.business_types.filter(b=>b.key!==key)});

  const updateBTLabel = (btKey, langCode, value) => {
    setCfg({
      ...cfg,
      business_types: cfg.business_types.map(b =>
        b.key === btKey ? { ...b, label: { ...(b.label || {}), [langCode]: value } } : b
      )
    });
  };

  const addPC = (btKey) => {
    const key = prompt("Key:"); if (!key) return;
    const label = prompt("English label:"); if (!label) return;
    setCfg({...cfg, product_categories: { ...cfg.product_categories, [btKey]: [...(cfg.product_categories[btKey]||[]), { key, label: { en: label } }] }});
  };
  const delPC = (btKey, pcKey) => setCfg({...cfg, product_categories: { ...cfg.product_categories, [btKey]: cfg.product_categories[btKey].filter(p=>p.key!==pcKey) }});

  const updatePCLabel = (btKey, pcKey, langCode, value) => {
    setCfg({
      ...cfg,
      product_categories: {
        ...cfg.product_categories,
        [btKey]: (cfg.product_categories[btKey] || []).map(p =>
          p.key === pcKey ? { ...p, label: { ...(p.label || {}), [langCode]: value } } : p
        )
      }
    });
  };

  const toggleModule = (btKey, pcKey, mod) => {
    const segKey = `${btKey}|${pcKey}`;
    const current = cfg.modules?.[segKey] || cfg.modules?._default || MODULES;
    const next = current.includes(mod) ? current.filter(m=>m!==mod) : [...current, mod];
    setCfg({...cfg, modules: { ...(cfg.modules||{}), [segKey]: next }});
  };

  const updateModuleLabel = (modKey, langCode, value) => {
    setModuleLabels({
      ...moduleLabels,
      [modKey]: { ...(moduleLabels[modKey] || {}), [langCode]: value }
    });
  };

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-black text-secondary">Quiz Options</h1>
          <p className="text-slate-500 text-sm">Manage Q1 business types, Q2 product categories, and which modules are available in Q3 per segment. All labels are editable in every active language.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={()=>switchMode(!rawMode)}><Code className="h-4 w-4 mr-2" />{rawMode?"Visual":"JSON"}</Button>
          <Button data-testid="save-quiz-cfg" onClick={save} className="bg-orange-600 hover:bg-orange-700 text-white"><Save className="h-4 w-4 mr-2" />Save</Button>
        </div>
      </div>

      {rawMode ? (
        <div>
          <div className="text-xs text-slate-500 mb-2">Edits here will sync to Visual mode and the live demo when you click Save.</div>
          <textarea data-testid="quiz-json" value={raw} onChange={e=>setRaw(e.target.value)} rows={28} className="w-full font-mono text-xs border border-slate-200 rounded-2xl p-4" />
        </div>
      ) : (
        <div className="space-y-6">
          <section>
            <div className="flex justify-between items-center mb-3">
              <div className="font-display font-bold text-lg text-secondary">Business Types (Q1)</div>
              <Button size="sm" onClick={addBusinessType} className="bg-orange-600 text-white"><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
            </div>
            <div className="grid gap-3">
              {cfg.business_types.map(bt => (
                <details key={bt.key} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <summary className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50">
                    <div>
                      <div className="font-display font-bold text-secondary">{bt.label?.en || bt.key}</div>
                      <div className="text-xs text-slate-500 font-mono">{bt.key}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{(cfg.product_categories[bt.key]||[]).length} products</span>
                      <button onClick={(e)=>{e.preventDefault(); delBusinessType(bt.key);}} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </summary>
                  <div className="p-4 border-t border-slate-100 space-y-4">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1.5">Labels per language</div>
                      <div className="grid grid-cols-2 gap-2">
                        {langCodes.map(lc => (
                          <div key={lc} className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase w-8">{lc}</span>
                            <input value={bt.label?.[lc] || ""} onChange={e=>updateBTLabel(bt.key, lc, e.target.value)}
                              placeholder={`${lc} label`} className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">Product Categories (Q2)</div>
                      <Button size="sm" variant="outline" onClick={()=>addPC(bt.key)}><Plus className="h-3 w-3 mr-1" />Product</Button>
                    </div>
                    {(cfg.product_categories[bt.key]||[]).map(pc => {
                      const segKey = `${bt.key}|${pc.key}`;
                      const enabled = cfg.modules?.[segKey] || cfg.modules?._default || MODULES;
                      return (
                        <div key={pc.key} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-secondary text-sm">{pc.label?.en || pc.key}</div>
                              <div className="text-xs text-slate-400 font-mono">{pc.key}</div>
                            </div>
                            <button onClick={()=>delPC(bt.key, pc.key)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {langCodes.map(lc => (
                              <div key={lc} className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase w-8">{lc}</span>
                                <input value={pc.label?.[lc] || ""} onChange={e=>updatePCLabel(bt.key, pc.key, lc, e.target.value)}
                                  placeholder={`${lc} label`} className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" />
                              </div>
                            ))}
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mt-1.5 mb-1.5">Q3 Modules available for this segment:</div>
                            <div className="flex flex-wrap gap-1.5">
                              {MODULES.map(m => (
                                <button key={m} onClick={()=>toggleModule(bt.key, pc.key, m)}
                                  className={`text-[10px] px-2 py-1 rounded-full font-bold transition-colors ${enabled.includes(m) ? "bg-orange-600 text-white" : "bg-white border border-slate-300 text-slate-500 hover:border-orange-300"}`}>
                                  {m}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="font-display font-bold text-lg text-secondary flex items-center gap-2"><Tag className="h-4 w-4" /> Module Labels</div>
                <div className="text-xs text-slate-500">Rename modules per language. These appear in Q3 of the quiz and on the demo player.</div>
              </div>
              <Button size="sm" onClick={saveModuleLabels} className="bg-orange-600 text-white"><Save className="h-3.5 w-3.5 mr-1" />Save Labels</Button>
            </div>
            <div className="grid gap-3">
              {MODULES.map(mod => {
                const open = showLabelsFor === mod;
                const lbls = moduleLabels[mod] || {};
                return (
                  <div key={mod} className="border border-slate-200 rounded-xl overflow-hidden">
                    <button onClick={()=>setShowLabelsFor(open ? null : mod)} className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-50">
                      <div className="text-left">
                        <div className="font-bold text-secondary text-sm">{lbls.en || mod}</div>
                        <div className="text-xs text-slate-400 font-mono">{mod}</div>
                      </div>
                      <span className="text-xs text-slate-500">{langCodes.filter(lc => lbls[lc]).length}/{langCodes.length} languages</span>
                    </button>
                    {open && (
                      <div className="px-4 py-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                        {langCodes.map(lc => (
                          <div key={lc} className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase w-8">{lc}</span>
                            <input value={lbls[lc] || ""} onChange={e=>updateModuleLabel(mod, lc, e.target.value)}
                              placeholder={`${lc} label`} className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
