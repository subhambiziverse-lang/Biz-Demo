import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useApp } from "../contexts/AppContext";
import { t, LANGS } from "../lib/i18n";
import { ArrowRight, Zap, ShieldCheck, Globe, Sparkles, Play } from "lucide-react";

export default function Landing() {
  const nav = useNavigate();
  const { lang, setLang, trackEvent } = useApp();

  const onStart = async () => { await trackEvent("landing_cta_clicked"); nav("/quiz"); };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-secondary text-white grid place-items-center font-display font-black">B</div>
            <span className="font-display font-black text-xl text-secondary">Biziverse</span>
            <span className="hidden sm:inline text-xs uppercase tracking-widest text-orange-600 font-bold ml-2 border-l border-slate-200 pl-3">Smart Demo</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              data-testid="lang-select"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="text-sm border border-slate-200 rounded-full px-3 py-2 bg-white font-medium"
            >
              {LANGS.map(l => <option key={l.code} value={l.code}>{l.native}</option>)}
            </select>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-grid">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/30 to-white pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-6 lg:px-12 pt-16 pb-16 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5 fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-100 rounded-full text-xs font-bold uppercase tracking-widest text-orange-600 mb-6">
              <Sparkles className="h-3.5 w-3.5" /> AI-guided product tour
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] xl:text-6xl font-black tracking-tight text-slate-950 leading-[1.05]">
              {t(lang, "headline")}
            </h1>
            <p className="mt-5 text-base lg:text-lg text-slate-600 max-w-md leading-relaxed">{t(lang, "subheadline")}</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button
                data-testid="start-demo-btn"
                onClick={onStart}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-base h-14 px-8 rounded-full shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all hover:-translate-y-0.5"
              >
                <Play className="mr-2 h-5 w-5 fill-white" /> {t(lang, "start_demo")} <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <span className="text-sm text-slate-500 font-medium">No signup • 2 minutes • 4 languages</span>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
              {[{i:Zap, t:"AI Narration", d:"Every step explained"},
                {i:ShieldCheck, t:"GST-ready", d:"GSTR1 · e-Invoice"},
                {i:Globe, t:"4 Languages", d:"EN · HI · GU · MR"}].map((f,i)=>(
                <div key={i}>
                  <div className="h-9 w-9 rounded-lg bg-orange-50 grid place-items-center"><f.i className="h-4.5 w-4.5 text-orange-600" /></div>
                  <div className="mt-2 font-display font-bold text-secondary text-sm">{f.t}</div>
                  <div className="text-xs text-slate-500">{f.d}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Biziverse product preview */}
          <div className="lg:col-span-7 relative fade-up">
            {/* Decorative offset block */}
            <div className="absolute -top-4 -right-4 inset-0 bg-orange-100 rounded-3xl hidden md:block" />
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-amber-200/60 rounded-full blur-3xl" />

            <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-white ring-1 ring-slate-200/80">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 border-b border-slate-200">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <div className="ml-3 flex-1 bg-white rounded-md px-3 py-1 text-xs text-slate-400 font-mono">app.biziverse.com</div>
              </div>
              <div className="relative">
                <img
                  src="https://biziverse.com/images/Screens/HeroImage.png"
                  alt="Biziverse product"
                  className="w-full h-auto block"
                />
                <button onClick={onStart} aria-label="Start demo"
                  className="absolute inset-0 grid place-items-center group bg-slate-950/0 hover:bg-slate-950/10 transition-colors"
                  data-testid="start-demo-hero-btn">
                  <span className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-orange-600 text-white grid place-items-center shadow-2xl shadow-orange-500/40 group-hover:scale-110 transition-transform ring-8 ring-white/40">
                    <Play className="h-7 w-7 sm:h-8 sm:w-8 fill-white ml-1" />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary text-slate-300 py-10 mt-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-wrap items-center justify-between gap-6">
          <div className="font-display font-black text-2xl text-white">Biziverse</div>
          <div className="flex gap-6 text-sm">
            <Link to="/privacy" className="hover:text-white">{t(lang,"privacy")}</Link>
            <Link to="/admin/login" data-testid="admin-link" className="hover:text-white">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
