import React from "react";
export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-3xl mx-auto px-6 py-20 prose prose-slate">
        <h1 className="font-display font-black text-4xl text-secondary">Privacy Notice</h1>
        <p className="text-slate-600 mt-4">Biziverse Smart Guided Demo collects anonymous interaction data to improve the demo experience. Your mobile number and OTP are encrypted and used only for account verification. We never share your data with third parties for marketing. Payment data is handled exclusively by Razorpay (PCI-DSS compliant). All transmission uses TLS 1.2+. Session recordings are anonymized.</p>
      </main>
    </div>
  );
}
