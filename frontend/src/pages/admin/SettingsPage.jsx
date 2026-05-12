import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Save } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [s, setS] = useState({ show_executive_cta: true, executive_phone: "" });
  useEffect(() => { api.get("/admin/settings").then(r => setS({...s, ...r.data})); /* eslint-disable-next-line */ }, []);
  const save = async () => { await api.put("/admin/settings", s); toast.success("Saved"); };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="font-display text-3xl font-black text-secondary">Global Settings</h1>
      <p className="text-slate-500 text-sm">Control global behavior of the public demo experience.</p>

      <div className="mt-8 space-y-5 bg-white border border-slate-200 rounded-2xl p-6">
        <label className="flex items-start gap-4 cursor-pointer">
          <input data-testid="set-exec" type="checkbox" checked={!!s.show_executive_cta}
            onChange={e=>setS({...s, show_executive_cta: e.target.checked})}
            className="mt-1 h-5 w-5 accent-orange-600" />
          <div>
            <div className="font-display font-bold text-secondary">Show "Talk with an executive" on landing page</div>
            <div className="text-xs text-slate-500">Turn this off to focus visitors on the demo CTA only.</div>
          </div>
        </label>

        <label className="block">
          <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1.5">Executive phone (display only — MVP)</div>
          <input value={s.executive_phone||""} onChange={e=>setS({...s, executive_phone: e.target.value})}
            placeholder="+91 80000 00000" className="w-full border border-slate-200 rounded-lg px-3 py-2" />
        </label>
      </div>

      <Button data-testid="save-settings" onClick={save} className="mt-5 bg-orange-600 hover:bg-orange-700 text-white"><Save className="h-4 w-4 mr-2" />Save</Button>
    </div>
  );
}
