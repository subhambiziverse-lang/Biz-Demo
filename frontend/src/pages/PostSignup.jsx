import React, { useState } from "react";
import { Button } from "../components/ui/button";
import { useApp } from "../contexts/AppContext";
import { t } from "../lib/i18n";
import { Check, ArrowRight } from "lucide-react";

export default function PostSignup() {
  const { lang } = useApp();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState([false, false, false]);

  const STEPS = [
    { key: "add_first_customer", desc: "Add your first customer to start tracking sales." },
    { key: "add_first_product", desc: "Add a product or service item with HSN/GST." },
    { key: "create_first_invoice", desc: "Create your first GST-compliant invoice." }
  ];

  const next = () => { const d = [...done]; d[step] = true; setDone(d); if (step < 2) setStep(step+1); };
  const skip = () => { if (step < 2) setStep(step+1); else setDone([true,true,true]); };

  if (done.every(x=>x)) {
    return (
      <div className="min-h-screen bg-background grid place-items-center px-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg">
          <div className="h-16 w-16 mx-auto rounded-full bg-emerald-100 grid place-items-center"><Check className="h-8 w-8 text-emerald-600" /></div>
          <h2 className="font-display text-3xl font-black text-secondary mt-6">You're all set!</h2>
          <p className="text-slate-600 mt-2">Welcome to Biziverse. Your account is ready.</p>
          <a href="https://app.biziverse.com" target="_blank" rel="noopener noreferrer">
            <Button data-testid="go-to-app" className="mt-6 bg-orange-600 hover:bg-orange-700 text-white rounded-full h-12 px-8 font-bold">Open Biziverse <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-grid">
      <header className="bg-white/70 border-b border-slate-200/50">
        <div className="max-w-3xl mx-auto px-6 py-4 font-display font-black text-xl text-secondary">Biziverse</div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-16 fade-up">
        <h1 className="font-display text-3xl sm:text-4xl font-black text-secondary">{t(lang, "onboarding_title")}</h1>
        <div className="mt-10 grid gap-3">
          {STEPS.map((s,i)=>(
            <div key={i} className={`p-5 rounded-2xl border-2 ${i===step?"border-orange-500 bg-white":done[i]?"border-emerald-200 bg-emerald-50":"border-slate-200 bg-white opacity-60"}`}>
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-full grid place-items-center font-bold text-sm ${done[i]?"bg-emerald-600 text-white":i===step?"bg-orange-600 text-white":"bg-slate-200 text-slate-500"}`}>
                  {done[i] ? <Check className="h-5 w-5" /> : i+1}
                </div>
                <div className="flex-1">
                  <div className="font-display font-bold text-secondary">{t(lang, s.key)}</div>
                  <div className="text-sm text-slate-500">{s.desc}</div>
                </div>
                {i===step && (
                  <div className="flex gap-2">
                    <Button data-testid={`onboard-skip-${i}`} variant="ghost" onClick={skip} size="sm">{t(lang,"skip")}</Button>
                    <Button data-testid={`onboard-next-${i}`} onClick={next} size="sm" className="bg-orange-600 hover:bg-orange-700 text-white rounded-full">Done</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
