import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { useApp } from "../contexts/AppContext";
import { t, LANGS } from "../lib/i18n";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import api from "../lib/api";

export default function Quiz() {
  const nav = useNavigate();
  const { lang, setLang, sessionId, trackEvent, setQuiz, setDemoData } = useApp();
  const [step, setStep] = useState(0);
  const [bt, setBt] = useState(null);
  const [pc, setPc] = useState(null);
  const [mods, setMods] = useState([]);
  const [bts, setBts] = useState([]);
  const [pcs, setPcs] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get("/quiz/options").then(r => setBts(r.data.business_types || [])); }, []);
  useEffect(() => {
    if (bt) api.get(`/quiz/options?business_type=${bt}`).then(r => setPcs(r.data.product_categories || []));
  }, [bt]);
  useEffect(() => {
    if (bt && pc) api.get(`/quiz/options?business_type=${bt}&product_category=${pc}`).then(r => setModules(r.data.modules || []));
  }, [bt, pc]);

  const labelOf = (item) => (item.label && (item.label[lang] || item.label.en)) || item.key;

  const pickBt = (k) => { setBt(k); trackEvent("quiz_q1_answered", { bt: k }); setStep(1); };
  const pickPc = (k) => { setPc(k); trackEvent("quiz_q2_answered", { bt, pc: k }); setStep(2); };
  const toggleMod = (k) => setMods(m => m.includes(k) ? m.filter(x => x !== k) : [...m, k]);

  const submit = async () => {
    setLoading(true);
    trackEvent("quiz_q3_answered", { bt, pc, modules: mods });
    try {
      const r = await api.post("/quiz/submit", {
        business_type: bt, product_category: pc, modules: mods,
        session_id: sessionId, language: lang
      });
      setQuiz({ bt, pc, mods });
      setDemoData(r.data);
      nav("/demo");
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background bg-grid">
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-display font-black text-xl text-secondary">Biziverse</div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">{[0,1,2].map(i => <div key={i} className={`h-1.5 w-8 rounded-full ${i<=step?"bg-orange-600":"bg-slate-200"}`} />)}</div>
            <select data-testid="quiz-lang-select" value={lang} onChange={e=>setLang(e.target.value)} className="text-sm border border-slate-200 rounded-full px-3 py-1.5 ml-3 bg-white">
              {LANGS.map(l=><option key={l.code} value={l.code}>{l.native}</option>)}
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        {step > 0 && (
          <Button data-testid="quiz-back" variant="ghost" onClick={()=>setStep(s=>s-1)} className="mb-6 text-slate-600">
            <ArrowLeft className="h-4 w-4 mr-2" /> {t(lang,"back")}
          </Button>
        )}

        {step === 0 && (
          <div className="fade-up">
            <div className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-3">Question 1 of 3</div>
            <h1 className="font-display text-3xl sm:text-4xl font-black text-secondary mb-2">{t(lang,"q1")}</h1>
            <p className="text-slate-500 mb-8">{t(lang,"select_one")}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {bts.map(b=>(
                <button key={b.key} data-testid={`q1-${b.key}`} onClick={()=>pickBt(b.key)}
                  className="text-left p-5 rounded-xl bg-white border border-slate-200 hover:border-orange-500 hover:shadow-lg hover:-translate-y-0.5 transition-all group">
                  <div className="font-display text-lg font-bold text-secondary group-hover:text-orange-600">{labelOf(b)}</div>
                  <div className="mt-2 text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight className="h-4 w-4" /></div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="fade-up">
            <div className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-3">Question 2 of 3</div>
            <h1 className="font-display text-3xl sm:text-4xl font-black text-secondary mb-8">{t(lang,"q2")}</h1>
            <div className="grid sm:grid-cols-2 gap-3">
              {pcs.map(p=>(
                <button key={p.key} data-testid={`q2-${p.key}`} onClick={()=>pickPc(p.key)}
                  className="text-left p-5 rounded-xl bg-white border border-slate-200 hover:border-orange-500 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  <div className="font-display text-lg font-bold text-secondary">{labelOf(p)}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="fade-up">
            <div className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-3">Question 3 of 3</div>
            <h1 className="font-display text-3xl sm:text-4xl font-black text-secondary mb-2">{t(lang,"q3")}</h1>
            <p className="text-slate-500 mb-8">{t(lang,"select_modules")}</p>
            <div className="grid sm:grid-cols-2 gap-2 mb-8">
              {modules.map(m=>{
                const active = mods.includes(m.key);
                return (
                  <button key={m.key} data-testid={`q3-${m.key}`} onClick={()=>toggleMod(m.key)}
                    className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${active?"bg-orange-50 border-orange-500 ring-2 ring-orange-200":"bg-white border-slate-200 hover:border-orange-300"}`}>
                    <div className={`h-5 w-5 rounded-md grid place-items-center border ${active?"bg-orange-600 border-orange-600 text-white":"border-slate-300"}`}>
                      {active && <Check className="h-3.5 w-3.5" />}
                    </div>
                    <span className="font-semibold text-secondary text-sm">{labelOf(m)}</span>
                  </button>
                );
              })}
            </div>
            <Button data-testid="quiz-start-demo" disabled={mods.length===0||loading} onClick={submit}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold h-14 px-10 rounded-full shadow-lg shadow-orange-500/30 disabled:opacity-50">
              {t(lang,"start_demo")} <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
