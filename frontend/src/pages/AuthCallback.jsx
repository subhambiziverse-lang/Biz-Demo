import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function AuthCallback() {
  const nav = useNavigate();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return; ran.current = true;
    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) { nav("/admin/login"); return; }
    const session_id = m[1];
    (async () => {
      try {
        // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
        await api.post("/auth/google-callback", { session_id });
        window.history.replaceState({}, "", "/admin");
        nav("/admin", { replace: true });
      } catch (e) {
        console.error(e); nav("/admin/login");
      }
    })();
  }, [nav]);
  return <div className="min-h-screen grid place-items-center text-slate-500">Signing you in…</div>;
}
