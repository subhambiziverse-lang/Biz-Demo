import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";

export default function LiveLeadDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [lead, setLead] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const wsRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastUserMsgRef = useRef(null);

  const loadLead = async () => {
    try {
      const res = await api.get(`/live-leads/${id}`);
      setLead(res.data);
    } catch (e) {
      toast.error("Unable to load lead");
      nav("/admin/live-leads");
    }
  };

  const loadMessages = async () => {
    try {
      const res = await api.get(`/live-leads/${id}/messages`);
      setMessages(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadLead();
    loadMessages();

    // connect websocket to lead channel for real-time messages
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/api/ws/live/lead:${id}`;
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === 'new_message' && data.message) {
            setMessages(m => [...m, data.message]);
          }
          if (data.type === 'agent_joined') {
            // refresh lead info
            loadLead();
            setMessages(m => [...m, { id: `sys_${Date.now()}`, role: 'agent', text: `Agent ${data.agent?.name || data.agent?.user_id} joined.`, created_at: new Date().toISOString() }]);
          }
          if (data.type === 'typing') {
            const status = data.payload?.status;
            if (status === 'start') {
              setMessages(m => [...m, { id: `typing_${Date.now()}`, role: 'agent', text: '…', _typing: true }]);
            } else if (status === 'stop') {
              setMessages(m => m.filter(x => !x._typing));
            }
          }
        } catch (e) { console.error(e); }
      };
    } catch (e) {
      console.error('ws connect failed', e);
    }

    return () => { if (wsRef.current) try { wsRef.current.close(); } catch(e){} };
  }, [id]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    try {
      await api.post(`/live-leads/${id}/messages`, { role: "agent", type: "text", text: input });
      setInput("");
    } catch (e) {
      toast.error("Failed to send message");
    }
  };

  const onInputKey = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    try {
      wsRef.current.send(JSON.stringify({ type: 'typing', payload: { status: 'start' } }));
    } catch (e) {}
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      try { wsRef.current.send(JSON.stringify({ type: 'typing', payload: { status: 'stop' } })); } catch (e) {}
    }, 1400);
  }

  const fetchSuggestions = async () => {
    // Suggest based on latest user message
    const latestUser = [...messages].reverse().find(m => m.role === "user");
    if (!latestUser) { toast.error("No user message to suggest for"); return; }
    try {
      const res = await api.post(`/admin/kb/suggest`, { question: latestUser.text, top_n: 5 });
      setSuggestions(res.data.candidates || []);
      lastUserMsgRef.current = latestUser.id;
    } catch (e) {
      toast.error("Failed to fetch KB suggestions");
    }
  };

  const sendKbAnswer = async (kbId) => {
    try {
      const all = await api.get('/admin/kb');
      const entry = (all.data || []).find(k => k.id === kbId);
      const ans = (entry?.answers?.en) || Object.values(entry?.answers || {})[0] || "";
      if (!ans) { toast.error("KB entry has no answer"); return; }
      await api.post(`/live-leads/${id}/messages`, { role: "agent", type: "text", text: ans });
      setSuggestions([]);
      loadMessages();
    } catch (e) {
      toast.error("Failed to send KB answer");
    }
  };

  // Auto-fetch KB suggestions when a new user message arrives
  useEffect(() => {
    const latestUser = [...messages].reverse().find(m => m.role === 'user');
    if (!latestUser) return;
    if (lastUserMsgRef.current === latestUser.id) return;
    // fetch suggestions automatically but don't show a toast on missing
    (async () => {
      try {
        const res = await api.post(`/admin/kb/suggest`, { question: latestUser.text, top_n: 5 });
        setSuggestions(res.data.candidates || []);
        lastUserMsgRef.current = latestUser.id;
      } catch (e) {
        console.error('kb suggest failed', e);
      }
    })();
  }, [messages]);

  if (!lead) return <div className="p-8">Loading…</div>;

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-black text-secondary">Live Lead · {lead.id}</h1>
          <div className="text-sm text-slate-500">Phone: {lead.phone} · Status: {lead.status}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => nav('/admin/live-leads')}>Back</Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-6">
        <div className="space-y-4">
          <div className="h-96 overflow-y-auto thin-scroll p-3 bg-slate-50 rounded-lg">
            {messages.map(m => (
              <div key={m.id} className={`mb-2 p-2 rounded ${m.role==='user' ? 'bg-orange-100 text-orange-800 ml-auto max-w-[70%]' : 'bg-white text-slate-800'}`}>
                <div className="text-sm">{m.text}</div>
                <div className="text-xs text-slate-400 mt-1">{new Date(m.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={onInputKey} placeholder="Message to lead" className="flex-1 border border-slate-200 rounded-lg px-3 py-2" />
            <Button onClick={sendMessage}>Send</Button>
            <Button variant="outline" onClick={fetchSuggestions}>KB suggestions</Button>
          </div>

          {suggestions.length > 0 && (
            <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-600 mb-2">KB suggestions</div>
              <div className="space-y-2">
                {suggestions.map(s => (
                  <div key={s.id} className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800">{s.question}</div>
                      <div className="text-xs text-slate-500 mt-1">{s.snippet}</div>
                    </div>
                    <Button size="sm" onClick={() => sendKbAnswer(s.id)}>Send</Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
