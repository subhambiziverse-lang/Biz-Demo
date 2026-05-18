import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { toast } from "sonner";
import { ArrowLeft, Send, Zap, Wifi, WifiOff, Phone, CheckCheck, Check } from "lucide-react";

export default function LiveLeadDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [lead, setLead] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [agentOnline, setAgentOnline] = useState(true);
  const [userTyping, setUserTyping] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const userTypingTimeoutRef = useRef(null);
  const lastUserMsgRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages, userTyping]);

  const mergeMessages = useCallback((incoming) => {
    setMessages(prev => {
      const confirmed = prev.filter(m => !m._pending);
      const existingIds = new Set(confirmed.map(m => m.id));
      const newMsgs = incoming.filter(m => !existingIds.has(m.id));
      const merged = [...confirmed, ...newMsgs].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );
      return merged;
    });
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const res = await api.get(`/live-leads/${id}/messages`);
      mergeMessages(res.data || []);
    } catch (e) {}
  }, [id, mergeMessages]);

  const loadLead = useCallback(async () => {
    try {
      const res = await api.get(`/live-leads/${id}`);
      setLead(res.data);
    } catch (e) {
      toast.error("Unable to load lead");
      nav("/admin/live-leads");
    }
  }, [id, nav]);

  const loadPresence = async () => {
    try {
      const res = await api.get("/admin/presence");
      setAgentOnline(res.data.online);
    } catch (e) {}
  };

  useEffect(() => {
    loadLead();
    loadMessages();
    loadPresence();

    const backendBase = process.env.REACT_APP_BACKEND_URL || window.location.origin;
    const wsBase = backendBase.replace(/^http/i, "ws");
    const url = `${wsBase}/api/ws/live/lead:${id}`;

    let pollId = null;
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);

          if (data.type === "new_message" && data.message) {
            const m = data.message;
            if (m.role === "user") {
              setMessages(prev => {
                if (prev.some(x => x.id === m.id)) return prev;
                return [...prev, m].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
              });
            }
          }

          if (data.type === "typing" && data.from === "user") {
            const status = data.payload?.status;
            setUserTyping(status === "start");
            clearTimeout(userTypingTimeoutRef.current);
            if (status === "start") {
              userTypingTimeoutRef.current = setTimeout(() => setUserTyping(false), 3000);
            }
          }
        } catch (e) {}
      };

      ws.onclose = () => setWsConnected(false);
      ws.onerror = () => setWsConnected(false);
    } catch (e) {}

    // Polling fallback every 4s
    pollId = setInterval(loadMessages, 4000);

    return () => {
      if (wsRef.current) try { wsRef.current.close(); } catch (e) {}
      clearInterval(pollId);
    };
  }, [id, loadMessages, loadLead]);

  // Auto-fetch KB suggestions when new user message arrives
  useEffect(() => {
    const latestUser = [...messages].reverse().find(m => m.role === "user");
    if (!latestUser || lastUserMsgRef.current === latestUser.id) return;
    (async () => {
      try {
        const res = await api.post("/admin/kb/suggest", { question: latestUser.text, top_n: 3 });
        setSuggestions(res.data.candidates || []);
        lastUserMsgRef.current = latestUser.id;
      } catch (e) {}
    })();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const text = input;
    setInput("");
    const tempId = `temp_${Date.now()}`;
    const now = new Date().toISOString();
    setMessages(prev => [...prev, { id: tempId, role: "agent", text, type: "text", created_at: now, _pending: true }]);
    try {
      await api.post(`/live-leads/${id}/messages`, { role: "agent", type: "text", text });
      loadMessages();
    } catch (e) {
      toast.error("Failed to send message");
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInput(text);
    }
  };

  const sendTypingSignal = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    try { wsRef.current.send(JSON.stringify({ type: "typing", payload: { status: "start" } })); } catch (e) {}
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      try { wsRef.current.send(JSON.stringify({ type: "typing", payload: { status: "stop" } })); } catch (e) {}
    }, 1400);
  };

  const onInputKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); return; }
    sendTypingSignal();
  };

  const togglePresence = async () => {
    const newVal = !agentOnline;
    setAgentOnline(newVal);
    try {
      await api.put("/admin/presence", { online: newVal });
      toast.success(newVal ? "You are now Online" : "You are now Offline");
    } catch (e) { setAgentOnline(!newVal); }
  };

  const useKbAnswer = async (kbId) => {
    try {
      const all = await api.get("/admin/kb");
      const entry = (all.data || []).find(k => k.id === kbId);
      const ans = (entry?.answers?.en) || Object.values(entry?.answers || {})[0] || "";
      if (!ans) { toast.error("KB entry has no answer"); return; }
      setInput(ans);
      setSuggestions([]);
      inputRef.current?.focus();
    } catch (e) { toast.error("Failed to load KB answer"); }
  };

  const fmtTime = (iso) => {
    try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
  };

  const fmtDate = (iso) => {
    try {
      const d = new Date(iso);
      const today = new Date();
      const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
      if (d.toDateString() === today.toDateString()) return "Today";
      if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
      return d.toLocaleDateString([], { day: "numeric", month: "short" });
    } catch { return ""; }
  };

  // Group messages by date
  const grouped = messages.reduce((acc, m) => {
    const day = fmtDate(m.created_at);
    if (!acc.length || acc[acc.length - 1].day !== day) acc.push({ day, msgs: [m] });
    else acc[acc.length - 1].msgs.push(m);
    return acc;
  }, []);

  if (!lead) return (
    <div className="flex items-center justify-center h-screen bg-[#0e1621] text-white/40">
      Loading conversation…
    </div>
  );

  return (
    <div data-testid="live-chat-container" className="flex flex-col h-screen" style={{ background: "#0e1621" }}>

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#1e2d3d] border-b border-white/10 flex-shrink-0">
        <button
          data-testid="back-to-leads"
          onClick={() => nav("/admin/live-leads")}
          className="text-white/50 hover:text-white transition-colors p-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Avatar */}
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 grid place-items-center text-white font-bold text-sm flex-shrink-0 shadow">
          {(lead.phone || "??").slice(-2)}
        </div>

        {/* User info */}
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm flex items-center gap-2">
            <Phone className="h-3 w-3 text-white/40" />
            +91 {lead.phone}
            <span className={`h-2 w-2 rounded-full flex-shrink-0 ${lead.status === "in_session" ? "bg-emerald-400 shadow-lg shadow-emerald-400/50" : "bg-amber-400"}`} />
          </div>
          <div className="text-xs text-white/40 truncate">
            {lead.business_type || "Demo user"}{lead.product_category ? ` · ${lead.product_category}` : ""}
            {lead.language ? ` · ${lead.language.toUpperCase()}` : ""}
          </div>
        </div>

        {/* WS indicator + Online toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {wsConnected
            ? <Wifi className="h-3.5 w-3.5 text-emerald-400" title="Live connection" />
            : <WifiOff className="h-3.5 w-3.5 text-slate-500" title="Polling mode" />
          }
          <button
            data-testid="agent-online-toggle"
            onClick={togglePresence}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              agentOnline
                ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30"
                : "bg-slate-700 text-slate-400 hover:bg-slate-600 border border-slate-600"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${agentOnline ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
            {agentOnline ? "Online" : "Offline"}
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
        style={{ backgroundImage: "radial-gradient(ellipse at 50% 0%, #0d1926 0%, #0a1120 100%)" }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-white/20">
            <div className="h-16 w-16 rounded-full bg-white/5 grid place-items-center">
              <Phone className="h-7 w-7" />
            </div>
            <div className="text-sm">Waiting for the user to send a message…</div>
          </div>
        )}

        {grouped.map(({ day, msgs }) => (
          <div key={day}>
            {/* Date separator */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[11px] text-white/30 px-3 py-1 bg-white/5 rounded-full">{day}</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {msgs.map((m) => (
              <div
                key={m.id}
                data-testid={`msg-${m.role}-${m.id}`}
                className={`flex mb-1.5 ${m.role === "agent" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[72%] rounded-2xl px-3.5 py-2 shadow-sm text-sm ${
                  m.role === "agent"
                    ? `bg-[#2b5278] text-white rounded-tr-sm ${m._pending ? "opacity-60" : ""}`
                    : "bg-[#182533] text-white rounded-tl-sm"
                }`}>
                  <div className="leading-relaxed break-words">{m.text}</div>
                  <div className={`flex items-center gap-1 mt-1 ${m.role === "agent" ? "justify-end" : "justify-start"}`}>
                    <span className="text-[10px] text-white/30">{fmtTime(m.created_at)}</span>
                    {m.role === "agent" && (
                      m._pending
                        ? <Check className="h-3 w-3 text-white/20" />
                        : <CheckCheck className="h-3 w-3 text-emerald-400/70" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Typing indicator */}
        {userTyping && (
          <div className="flex justify-start mb-1.5">
            <div className="bg-[#182533] px-4 py-3 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1 items-center h-4">
                {[0, 150, 300].map(delay => (
                  <span
                    key={delay}
                    className="h-2 w-2 rounded-full bg-white/40 animate-bounce"
                    style={{ animationDelay: `${delay}ms`, animationDuration: "0.9s" }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── KB Quick Replies ── */}
      {suggestions.length > 0 && (
        <div className="px-4 py-2.5 bg-[#152030] border-t border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-3 w-3 text-orange-400" />
            <span className="text-[11px] text-white/40 font-bold uppercase tracking-wider">Quick Replies</span>
            <button
              onClick={() => setSuggestions([])}
              className="ml-auto text-white/20 hover:text-white/50 text-xs transition-colors"
            >
              Dismiss
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(s => (
              <button
                key={s.id}
                data-testid={`kb-suggestion-${s.id}`}
                onClick={() => useKbAnswer(s.id)}
                title={s.snippet}
                className="text-xs bg-[#2b5278] hover:bg-[#3a6a9a] text-white/90 px-3 py-1.5 rounded-full transition-colors truncate max-w-[240px]"
              >
                {s.question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input ── */}
      <div className="px-4 py-3 bg-[#1e2d3d] border-t border-white/10 flex items-end gap-3 flex-shrink-0">
        <textarea
          ref={inputRef}
          data-testid="agent-chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onInputKey}
          placeholder="Type a message…"
          rows={1}
          className="flex-1 bg-[#2a3f55] text-white placeholder-white/25 border-0 rounded-2xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#3a6a9a]/60 leading-relaxed"
          style={{ maxHeight: "120px", scrollbarWidth: "none" }}
          onInput={e => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
        />
        <button
          data-testid="agent-chat-send"
          onClick={sendMessage}
          disabled={!input.trim()}
          className="h-10 w-10 rounded-full bg-[#2b5278] hover:bg-[#3a6a9a] text-white grid place-items-center flex-shrink-0 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
