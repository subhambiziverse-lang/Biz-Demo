import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../lib/api";

const Ctx = createContext(null);

const detectLang = () => {
  const stored = localStorage.getItem("biz_lang");
  if (stored) return stored;
  const b = (navigator.language || "en").toLowerCase();
  if (b.startsWith("hi")) return "hi";
  if (b.startsWith("gu")) return "gu";
  if (b.startsWith("mr")) return "mr";
  return "en";
};

export function AppProvider({ children }) {
  const [lang, setLangState] = useState(detectLang());
  const [voiceOn, setVoiceOn] = useState(true);
  const [sessionId, setSessionId] = useState(localStorage.getItem("biz_sid") || null);
  const [quiz, setQuiz] = useState(null);
  const [demoData, setDemoData] = useState(null);

  const setLang = (l) => { localStorage.setItem("biz_lang", l); setLangState(l); };

  const startSession = async () => {
    try {
      const r = await api.post("/sessions/start");
      setSessionId(r.data.session_id);
      localStorage.setItem("biz_sid", r.data.session_id);
      return r.data.session_id;
    } catch (e) { console.error(e); return null; }
  };

  const trackEvent = async (event_type, payload = {}) => {
    if (!sessionId) return;
    try { await api.post("/sessions/event", { session_id: sessionId, event_type, payload }); } catch (e) {}
  };

  useEffect(() => { if (!sessionId) startSession(); /* eslint-disable-next-line */ }, []);

  return (
    <Ctx.Provider value={{ lang, setLang, voiceOn, setVoiceOn, sessionId, startSession, trackEvent, quiz, setQuiz, demoData, setDemoData }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
