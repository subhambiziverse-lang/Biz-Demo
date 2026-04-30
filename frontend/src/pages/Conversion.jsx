import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useApp } from "../contexts/AppContext";
import { t } from "../lib/i18n";
import { TrendingUp, Wallet, RefreshCcw, MessageCircle, Phone, Calendar } from "lucide-react";

export default function Conversion() {
  const nav = useNavigate();
  const { lang, trackEvent } = useApp();
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => { trackEvent("conversion_viewed"); const t = setTimeout(() => setShowFallback(true), 60000); return () => clearTimeout(t); /* eslint-disable-next-line */ }, []);

  const goSignup = () => { trackEvent("signup_started"); nav("/signup"); };

  const metrics = [
    { i: TrendingUp, l: t(lang, "sales_total"), v: "₹12,84,000", color: "text-emerald-600 bg-emerald-50" },
    { i: Wallet, l: t(lang, "pending"), v: "₹3,42,000", color: "text-amber-600 bg-amber-50" },
    { i: RefreshCcw, l: t(lang, "recovered"), v: "₹1,76,500", color: "text-orange-600 bg-orange-50" },
  ];

  return (
    <div className="min-h-screen bg-background bg-grid">
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/50">
        <div className="max-w-5xl mx-auto px-6 py-4 font-display font-black text-xl text-secondary">Biziverse</div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-16 fade-up">
        <div className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-3">Demo complete</div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black text-secondary leading-[1.05]">{t(lang,"summary_title")}</h1>

        <div className="grid sm:grid-cols-3 gap-4 mt-12">
          {metrics.map((m,i)=>(
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
              <div className={`h-10 w-10 rounded-xl grid place-items-center ${m.color}`}><m.i className="h-5 w-5" /></div>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-4">{m.l}</div>
              <div className="font-display text-3xl font-black text-secondary mt-1">{m.v}</div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-secondary text-white rounded-3xl p-10 relative overflow-hidden">
          <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-orange-600/30 to-transparent" />
          <div className="relative">
            <div className="text-xs uppercase tracking-widest text-amber-300 font-bold">Take action</div>
            <h2 className="font-display text-2xl sm:text-3xl font-black mt-2 max-w-xl">Your business is losing ₹3L+ to manual tracking. Fix it today.</h2>
            <div className="flex flex-wrap gap-3 mt-8">
              <Button data-testid="cta-trial" onClick={goSignup} className="bg-orange-600 hover:bg-orange-700 text-white font-bold h-12 px-8 rounded-full">{t(lang,"start_free_trial")}</Button>
              <Button data-testid="cta-full" onClick={goSignup} variant="outline" className="bg-transparent text-white border-white/30 hover:bg-white/10 h-12 px-8 rounded-full">{t(lang,"get_full_access")}</Button>
            </div>
          </div>
        </div>

        {showFallback && (
          <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-6 fade-up">
            <div className="font-display font-bold text-secondary text-lg mb-1">{t(lang,"need_help")}</div>
            <div className="text-sm text-slate-500 mb-4">Reach out to our team — we're online now.</div>
            <div className="flex flex-wrap gap-3">
              <Button data-testid="fb-chat" variant="outline" className="rounded-full"><MessageCircle className="h-4 w-4 mr-2" />{t(lang,"chat")}</Button>
              <a href="tel:+918000000000"><Button data-testid="fb-call" variant="outline" className="rounded-full"><Phone className="h-4 w-4 mr-2" />{t(lang,"call")}</Button></a>
              <Button data-testid="fb-schedule" variant="outline" className="rounded-full"><Calendar className="h-4 w-4 mr-2" />{t(lang,"schedule_demo")}</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
