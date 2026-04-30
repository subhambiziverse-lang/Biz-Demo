import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useApp } from "../contexts/AppContext";
import { t } from "../lib/i18n";
import api from "../lib/api";
import { toast } from "sonner";
import { Check, ShieldCheck } from "lucide-react";

export default function Signup() {
  const nav = useNavigate();
  const { lang, sessionId, trackEvent } = useApp();
  const [step, setStep] = useState(0);
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [mockOtp, setMockOtp] = useState("");
  const [plan, setPlan] = useState("yearly");
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    if (!/^\d{10}$/.test(mobile)) return toast.error("Enter a valid 10-digit mobile");
    setLoading(true);
    try {
      const r = await api.post("/signup/otp/send", { mobile });
      setMockOtp(r.data.mock_otp);
      toast.success(`OTP sent (mock): ${r.data.mock_otp}`);
      trackEvent("otp_sent");
      setStep(1);
    } catch (e) { toast.error("Failed to send OTP"); }
    setLoading(false);
  };

  const verifyOtp = async () => {
    setLoading(true);
    try {
      await api.post("/signup/otp/verify", { mobile, otp, session_id: sessionId });
      toast.success("OTP verified");
      trackEvent("otp_verified");
      setStep(2);
    } catch (e) { toast.error(e.response?.data?.detail || "Invalid OTP"); }
    setLoading(false);
  };

  const pay = async () => {
    setLoading(true);
    try {
      const r = await api.post("/signup/payment", { mobile, plan });
      trackEvent("payment_completed", { plan, amount: r.data.amount });
      toast.success("Payment successful (mocked)");
      nav("/onboarding");
    } catch (e) { toast.error("Payment failed"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background bg-grid">
      <header className="bg-white/70 border-b border-slate-200/50">
        <div className="max-w-3xl mx-auto px-6 py-4 font-display font-black text-xl text-secondary">Biziverse</div>
      </header>
      <main className="max-w-xl mx-auto px-6 py-16 fade-up">
        {step === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8">
            <h2 className="font-display text-3xl font-black text-secondary">{t(lang,"enter_mobile")}</h2>
            <p className="text-slate-500 text-sm mt-1">We'll send a one-time password to verify.</p>
            <input data-testid="mobile-input" type="tel" maxLength={10} value={mobile} onChange={e=>setMobile(e.target.value.replace(/\D/g,""))}
              placeholder="9876543210" className="mt-6 w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-lg font-mono focus:outline-none focus:border-orange-500" />
            <Button data-testid="send-otp-btn" disabled={loading} onClick={sendOtp} className="mt-6 w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-12 rounded-full">{t(lang,"send_otp")}</Button>
          </div>
        )}

        {step === 1 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8">
            <h2 className="font-display text-3xl font-black text-secondary">{t(lang,"enter_otp")}</h2>
            <p className="text-slate-500 text-sm mt-1">Sent to +91 {mobile}. <span className="text-orange-600 font-semibold">Demo OTP: {mockOtp}</span></p>
            <input data-testid="otp-input" type="tel" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,""))}
              placeholder="000000" className="mt-6 w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-2xl font-mono tracking-[0.5em] text-center focus:outline-none focus:border-orange-500" />
            <Button data-testid="verify-otp-btn" disabled={loading||otp.length!==6} onClick={verifyOtp} className="mt-6 w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-12 rounded-full">{t(lang,"verify_otp")}</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-display text-3xl font-black text-secondary">Choose your plan</h2>
            <div className="grid gap-3">
              {[
                { k: "monthly", label: t(lang, "monthly"), sub: "Billed monthly", features: ["All modules", "Unlimited invoices", "WhatsApp recovery"] },
                { k: "yearly", label: t(lang, "yearly"), sub: "Save ₹1,989 vs monthly", features: ["Everything in monthly", "Priority support", "Free onboarding call"] }
              ].map(p => (
                <button key={p.k} data-testid={`plan-${p.k}`} onClick={()=>setPlan(p.k)}
                  className={`text-left p-5 rounded-2xl border-2 transition-all ${plan===p.k?"border-orange-600 bg-orange-50":"border-slate-200 bg-white hover:border-orange-300"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-display text-2xl font-black text-secondary">{p.label}</div>
                      <div className="text-xs text-slate-500">{p.sub}</div>
                    </div>
                    {plan===p.k && <div className="h-6 w-6 rounded-full bg-orange-600 grid place-items-center text-white"><Check className="h-4 w-4"/></div>}
                  </div>
                  <ul className="mt-3 grid gap-1 text-sm text-slate-600">
                    {p.features.map((f,i)=><li key={i} className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-orange-600" />{f}</li>)}
                  </ul>
                </button>
              ))}
            </div>
            <Button data-testid="pay-btn" disabled={loading} onClick={pay} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-12 rounded-full">{t(lang,"pay_now")}</Button>
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Secure payment via Razorpay (mocked in demo)</div>
          </div>
        )}
      </main>
    </div>
  );
}
