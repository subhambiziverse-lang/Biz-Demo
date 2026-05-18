import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Save } from "lucide-react";
import { toast } from "sonner";

const LANGS = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "gu", label: "Gujarati" },
  { code: "mr", label: "Marathi" },
];

const MODEL_OPTIONS = [
  { label: "OpenAI gpt-4o-mini", value: "openai|gpt-4o-mini" },
  { label: "OpenAI gpt-4.1", value: "openai|gpt-4.1" },
  { label: "OpenAI gpt-4.1-mini", value: "openai|gpt-4.1-mini" },
  { label: "OpenAI gpt-5.2", value: "openai|gpt-5.2" },
  { label: "Claude 3.5", value: "anthropic|claude-3.5" },
  { label: "Claude 3.5 100k", value: "anthropic|claude-3.5-100k" },
  { label: "Claude 4", value: "anthropic|claude-4" },
  { label: "Claude Instant", value: "anthropic|claude-instant" },
];

const DEFAULT_AI_SETTINGS = {
  enabled: true,
  name: "Biziverse AI",
  avatar_url: "https://biziverse.com/WebExt/img/logo2.jpg",
  primary_color: "#f97316",
  secondary_color: "#0f172a",
  background_color: "#ffffff",
  llm_model: { provider: "openai", model: "gpt-4o-mini" },
  api_key: "",
  show_exec_cta_on_direct_intent: true,
  show_exec_cta_on_no_answer: true,
  show_exec_cta_on_ambiguous: false,
  greeting: {
    en: "Hi! I can answer questions about Biziverse. What would you like to know?",
    hi: "नमस्ते! मैं Biziverse के बारे में सवालों के जवाब दे सकता हूँ। आप क्या जानना चाहेंगे?",
    gu: "નમસ્તે! હું Biziverse વિશે પ્રશ્નોના જવાબ આપી શકું છું.",
    mr: "नमस्कार! मी Biziverse विषयी प्रश्नांची उत्तरे देऊ शकतो.",
  },
  executive_response: {
    en: "Sure! Our team will be happy to connect with you. Please use the button below to talk with an executive.",
    hi: "बिल्कुल! हमारी टीम आपसे बात करने में खुश होगी। नीचे दिए बटन से executive से बात करें।",
    gu: "ચોક્કસ! અમારી ટીમ તમારા સાથે વાત કરવા માટે ખુશ રહેશે. નીચે બટન પર ક્લિક કરો.",
    mr: "नक्कीच! आमची टीम तुमच्याशी बोलण्यास तयार आहे. खालील बटणाचा वापर करा.",
  },
  pricing_response: {
    en: "For pricing details and the best plan for your business, our team would love to walk you through it personally.",
    hi: "आपके व्यापार के लिए सही plan और pricing जानने के लिए हमारी team से बात करें।",
    gu: "તમારા વ્યવસાય માટે યોગ્ય પ્લાન અને પ્રાઇસિંગ જાણવા માટે અમારી ટીમ સાથે વાત કરો.",
    mr: "तुमच्या व्यवसायासाठी योग्य योजना आणि किंमत जाणून घेण्यासाठी आमच्या टीमशी बोला.",
  },
  fallback_response: {
    en: "I don't have an answer for that yet. Would you like to talk with an executive?",
    hi: "मेरे पास इसका जवाब अभी नहीं है। क्या आप किसी executive से बात करना चाहेंगे?",
    gu: "મારે પાસે આ જવાબ હજુ મળ્યો નથી. શું તમે executive સાથે વાત કરવા માંગો છો?",
    mr: "माझ्याकडे हा प्रश्न अजूनपर्यंत आहे. कार्यकारीशी बोलू इच्छिता?",
  },
};

const DEFAULT_SETTINGS = {
  show_executive_cta: true,
  executive_phone: "",
  ai_settings: DEFAULT_AI_SETTINGS,
};

function mergeSettings(raw = {}) {
  const ai = raw.ai_settings || {};
  return {
    show_executive_cta: raw.show_executive_cta ?? DEFAULT_SETTINGS.show_executive_cta,
    executive_phone: raw.executive_phone ?? DEFAULT_SETTINGS.executive_phone,
    ai_settings: {
      ...DEFAULT_AI_SETTINGS,
      ...ai,
      greeting: { ...DEFAULT_AI_SETTINGS.greeting, ...(ai.greeting || {}) },
      executive_response: { ...DEFAULT_AI_SETTINGS.executive_response, ...(ai.executive_response || {}) },
      pricing_response: { ...DEFAULT_AI_SETTINGS.pricing_response, ...(ai.pricing_response || {}) },
      fallback_response: { ...DEFAULT_AI_SETTINGS.fallback_response, ...(ai.fallback_response || {}) },
      llm_model: { ...DEFAULT_AI_SETTINGS.llm_model, ...(ai.llm_model || {}) },
    },
  };
}

export default function SettingsPage() {
  const [s, setS] = useState(DEFAULT_SETTINGS);
  const [tab, setTab] = useState("global");

  useEffect(() => {
    api.get("/admin/settings").then(r => setS(mergeSettings(r.data))).catch(() => {});
  }, []);

  const save = async () => {
    await api.put("/admin/settings", s);
    toast.success("Saved");
  };

  const updateAi = (updates) => setS({ ...s, ai_settings: { ...s.ai_settings, ...updates } });

  const renderLocalizedText = (fieldKey, label) => (
    <div className="space-y-3">
      <div className="text-sm font-semibold uppercase tracking-wide text-slate-600">{label}</div>
      <div className="grid gap-3">
        {LANGS.map((lang) => (
          <label key={lang.code} className="block">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1">{lang.label}</div>
            <textarea
              rows={2}
              value={s.ai_settings[fieldKey]?.[lang.code] || ""}
              onChange={(e) => updateAi({
                ...s.ai_settings,
                [fieldKey]: { ...s.ai_settings[fieldKey], [lang.code]: e.target.value }
              })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </label>
        ))}
      </div>
    </div>
  );

  const currentModelValue = `${s.ai_settings.llm_model.provider}|${s.ai_settings.llm_model.model}`;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-black text-secondary">Settings</h1>
          <p className="text-slate-500 text-sm">Edit global demo and AI behavior from one place.</p>
        </div>
        <div className="flex gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setTab("global")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === "global" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900"}`}
          >Global</button>
          <button
            type="button"
            onClick={() => setTab("ai")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === "ai" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900"}`}
          >AI Settings</button>
        </div>
      </div>

      <div className="mt-8 bg-white border border-slate-200 rounded-3xl p-6 space-y-6">
        {tab === "global" ? (
          <div className="space-y-5">
            <label className="flex items-start gap-4 cursor-pointer">
              <input
                data-testid="set-exec"
                type="checkbox"
                checked={!!s.show_executive_cta}
                onChange={e => setS({ ...s, show_executive_cta: e.target.checked })}
                className="mt-1 h-5 w-5 accent-orange-600"
              />
              <div>
                <div className="font-display font-bold text-secondary">Show "Talk with an executive" on landing page</div>
                <div className="text-xs text-slate-500">Turn this off to focus visitors on the demo CTA only.</div>
              </div>
            </label>

            <label className="block">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1.5">Executive phone (display only)</div>
              <input
                value={s.executive_phone || ""}
                onChange={e => setS({ ...s, executive_phone: e.target.value })}
                placeholder="+91 80000 00000"
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
            </label>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1.5">Chatbot visible</div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={!!s.ai_settings.enabled}
                    onChange={e => updateAi({ enabled: e.target.checked })}
                    className="h-5 w-5 accent-orange-600"
                  />
                  <span className="text-sm text-slate-600">Show chatbot in the public demo</span>
                </div>
              </label>
              <label className="block">
                <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1.5">Chatbot name</div>
                <input
                  value={s.ai_settings.name || ""}
                  onChange={e => updateAi({ name: e.target.value })}
                  placeholder="Biziverse AI"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1.5">Avatar URL</div>
                <input
                  value={s.ai_settings.avatar_url || ""}
                  onChange={e => updateAi({ avatar_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                />
              </label>
              <label className="block">
                <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1.5">Primary color</div>
                <input
                  type="color"
                  value={s.ai_settings.primary_color}
                  onChange={e => updateAi({ primary_color: e.target.value })}
                  className="w-20 h-12 rounded-lg border border-slate-200 p-0"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1.5">Secondary color</div>
                <input
                  type="color"
                  value={s.ai_settings.secondary_color}
                  onChange={e => updateAi({ secondary_color: e.target.value })}
                  className="w-20 h-12 rounded-lg border border-slate-200 p-0"
                />
              </label>
              <label className="block">
                <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1.5">Background color</div>
                <input
                  type="color"
                  value={s.ai_settings.background_color}
                  onChange={e => updateAi({ background_color: e.target.value })}
                  className="w-20 h-12 rounded-lg border border-slate-200 p-0"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1.5">LLM model</div>
                <select
                  value={currentModelValue}
                  onChange={e => {
                    const [provider, model] = e.target.value.split("|");
                    updateAi({ llm_model: { provider, model } });
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                >
                  {MODEL_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1.5">Custom API key</div>
                <input
                  value={s.ai_settings.api_key || ""}
                  onChange={e => updateAi({ api_key: e.target.value })}
                  placeholder="Override backend key"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!s.ai_settings.show_exec_cta_on_direct_intent}
                  onChange={e => updateAi({ show_exec_cta_on_direct_intent: e.target.checked })}
                  className="h-4 w-4 accent-orange-600"
                />
                <span className="text-sm text-slate-600">CTA on executive/pricing intent</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!s.ai_settings.show_exec_cta_on_no_answer}
                  onChange={e => updateAi({ show_exec_cta_on_no_answer: e.target.checked })}
                  className="h-4 w-4 accent-orange-600"
                />
                <span className="text-sm text-slate-600">CTA on no-answer fallback</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!s.ai_settings.show_exec_cta_on_ambiguous}
                  onChange={e => updateAi({ show_exec_cta_on_ambiguous: e.target.checked })}
                  className="h-4 w-4 accent-orange-600"
                />
                <span className="text-sm text-slate-600">CTA on ambiguous suggestions</span>
              </label>
            </div>

            <div className="border-t border-slate-200 pt-6 space-y-6">
              {renderLocalizedText("greeting", "Greeting text")}
              {renderLocalizedText("executive_response", "Executive intent response")}
              {renderLocalizedText("pricing_response", "Pricing intent response")}
              {renderLocalizedText("fallback_response", "Fallback response for unknown questions")}
            </div>
          </div>
        )}
      </div>

      <Button data-testid="save-settings" onClick={save} className="mt-6 bg-orange-600 hover:bg-orange-700 text-white"><Save className="h-4 w-4 mr-2" />Save</Button>
    </div>
  );
}
