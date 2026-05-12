import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Plus, Trash2, Save, Globe } from "lucide-react";
import { toast } from "sonner";

// Most common languages an Indian SaaS demo would ship. Admin can still type anything.
const COMMON = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "or", label: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "as", label: "Assamese", native: "অসমীয়া" },
  { code: "ur", label: "Urdu", native: "اردو" },
];

export default function LanguagesPage() {
  const [langs, setLangs] = useState([]);
  const [draft, setDraft] = useState({ code: "", label: "", native: "" });

  const load = () => api.get("/languages").then(r => setLangs(r.data.languages || []));
  useEffect(() => { load(); }, []);

  const add = (preset) => {
    const next = preset || draft;
    const code = (next.code || "").trim().toLowerCase();
    if (!code) return toast.error("Code is required (e.g. 'ta')");
    if (langs.some(l => l.code === code)) return toast.error("Code already added");
    const entry = {
      code,
      label: (next.label || code.toUpperCase()).trim(),
      native: (next.native || next.label || code.toUpperCase()).trim(),
    };
    setLangs([...langs, entry]);
    setDraft({ code: "", label: "", native: "" });
  };

  const remove = (code) => setLangs(langs.filter(l => l.code !== code));

  const update = (code, field, value) => {
    setLangs(langs.map(l => l.code === code ? { ...l, [field]: value } : l));
  };

  const save = async () => {
    if (langs.length === 0) return toast.error("Keep at least one language");
    try {
      await api.put("/admin/languages", { languages: langs });
      toast.success("Languages saved — refresh the public demo to see them");
    } catch (e) { toast.error("Save failed"); }
  };

  const notAddedCommon = COMMON.filter(c => !langs.some(l => l.code === c.code));

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-black text-secondary flex items-center gap-2"><Globe className="h-7 w-7" /> Languages</h1>
          <p className="text-slate-500 text-sm">Add or remove the languages users can pick on the demo. Add a new language here, then translate labels in the Quiz Options page.</p>
        </div>
        <Button data-testid="save-languages" onClick={save} className="bg-orange-600 hover:bg-orange-700 text-white"><Save className="h-4 w-4 mr-2" />Save</Button>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3">Active languages</div>
        <div className="space-y-2">
          {langs.map((l) => (
            <div key={l.code} className="grid grid-cols-12 gap-2 items-center bg-slate-50 border border-slate-200 rounded-xl p-2.5">
              <div className="col-span-2 text-xs font-mono uppercase font-bold text-slate-600">{l.code}</div>
              <input className="col-span-4 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm" value={l.label} onChange={e=>update(l.code, "label", e.target.value)} placeholder="English label" />
              <input className="col-span-5 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm" value={l.native} onChange={e=>update(l.code, "native", e.target.value)} placeholder="Native label" />
              <button data-testid={`remove-lang-${l.code}`} onClick={()=>remove(l.code)} className="col-span-1 text-red-500 hover:bg-red-50 rounded p-1.5"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {langs.length === 0 && <div className="text-sm text-slate-400 italic">No languages — add at least one.</div>}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3">Add a new language</div>
        <div className="grid grid-cols-12 gap-2 items-center">
          <input data-testid="new-lang-code" className="col-span-2 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-mono uppercase" value={draft.code} onChange={e=>setDraft({...draft, code: e.target.value})} placeholder="code (e.g. ta)" />
          <input data-testid="new-lang-label" className="col-span-4 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm" value={draft.label} onChange={e=>setDraft({...draft, label: e.target.value})} placeholder="English label" />
          <input data-testid="new-lang-native" className="col-span-5 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm" value={draft.native} onChange={e=>setDraft({...draft, native: e.target.value})} placeholder="Native script" />
          <Button data-testid="add-lang" onClick={()=>add(null)} size="sm" className="col-span-1 bg-orange-600 text-white"><Plus className="h-4 w-4" /></Button>
        </div>
      </section>

      {notAddedCommon.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3">Quick-add common Indian languages</div>
          <div className="flex flex-wrap gap-2">
            {notAddedCommon.map(c => (
              <button key={c.code} data-testid={`quick-add-${c.code}`} onClick={()=>add(c)}
                className="px-3 py-1.5 text-xs rounded-full bg-slate-100 hover:bg-orange-50 hover:border-orange-300 border border-slate-200 transition-colors">
                <span className="font-mono uppercase text-slate-500 mr-2">{c.code}</span>
                <span className="text-secondary font-medium">{c.label}</span>
                <span className="text-slate-400 ml-2">{c.native}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
        💡 <strong>Tip:</strong> When a user picks a language for which a video isn't uploaded yet, the demo automatically requests YouTube's auto-translated captions in that language — so the video stays usable while you produce the dubbed version.
      </div>
    </div>
  );
}
