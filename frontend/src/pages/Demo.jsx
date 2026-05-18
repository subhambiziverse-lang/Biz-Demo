import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useApp } from "../contexts/AppContext";
import { t, LANGS } from "../lib/i18n";
import { voice } from "../lib/voice";
import api from "../lib/api";
import {
  Pause, Play, ExternalLink, Volume2, VolumeX, Send, Sparkles,
  ArrowLeft, Maximize2, Minimize2, X, MessageCircle, Subtitles, UserCheck,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { loadYouTubeAPI, extractYouTubeId, isYouTube } from "../lib/youtube";

// ── Quality options for YouTube ───────────────────────────────────────────────
const YT_QUALITIES = [
  { key: "hd1080", label: "1080p HD" },
  { key: "hd720",  label: "720p"     },
  { key: "large",  label: "480p"     },
  { key: "medium", label: "360p"     },
  { key: "small",  label: "240p"     },
];

// ── Auto-hiding controls bar ──────────────────────────────────────────────────
function ControlsBar({
  progress, duration, playing, captionsOn,
  onSeek, onTogglePlay, onSkip, onToggleCaptions,
  isYT, ytPlayerRef
}) {
  const [visible, setVisible]         = useState(true);
  const [showQuality, setShowQuality] = useState(false);
  const [currentQuality, setCurrentQuality] = useState("hd1080");
  const hideTimer = useRef(null);

  const resetTimer = () => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      setShowQuality(false);
    }, 3000);
  };

  // Start hide timer on mount
  useEffect(() => {
    resetTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
    // eslint-disable-next-line
  }, []);

  // Reset timer when play state changes so controls briefly reappear
  useEffect(() => { resetTimer(); }, [playing]);

  const applyQuality = (q) => {
    try {
      ytPlayerRef.current?.setPlaybackQuality?.(q);
      ytPlayerRef.current?.setPlaybackQualityRange?.(q, q);
    } catch (e) {}
    setCurrentQuality(q);
    setShowQuality(false);
    resetTimer();
  };

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30"
      onMouseMove={resetTimer}
      onMouseEnter={resetTimer}
      onTouchStart={resetTimer}
    >
      <div
        className="px-4 py-3 bg-gradient-to-t from-slate-950/85 to-transparent backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
      >
        {/* Timeline */}
        <div className="flex items-center gap-2 mb-2">
          <div className="text-xs text-white/80 font-mono w-12 text-right">{fmtTime(progress)}</div>
          <div
            className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer hover:h-2 transition-all"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              onSeek((e.clientX - r.left) / r.width);
            }}
          >
            <div className="h-full bg-orange-500" style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }} />
          </div>
          <div className="text-xs text-white/80 font-mono w-12">{fmtTime(duration)}</div>
        </div>

        {/* Buttons row */}
        <div className="flex items-center gap-1">

          {/* Back 10s */}
          <button
            data-testid="seek-back"
            onClick={() => onSkip(-10)}
            title="Back 10 seconds"
            className="h-10 w-10 rounded-full text-white hover:bg-white/10 grid place-items-center relative"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 8"/>
            </svg>
            <span className="absolute text-[9px] font-black mt-0.5">10</span>
          </button>

          {/* Play / Pause */}
          <button
            data-testid="player-play-pause"
            onClick={onTogglePlay}
            title="Play/Pause"
            className="h-10 w-10 rounded-full bg-white text-slate-950 hover:bg-orange-500 hover:text-white grid place-items-center transition-colors"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>

          {/* Forward 10s */}
          <button
            data-testid="seek-fwd"
            onClick={() => onSkip(10)}
            title="Forward 10 seconds"
            className="h-10 w-10 rounded-full text-white hover:bg-white/10 grid place-items-center relative"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/><path d="M21 13a9 9 0 1 1-3-7.7L21 8"/>
            </svg>
            <span className="absolute text-[9px] font-black mt-0.5">10</span>
          </button>

          <div className="flex-1" />

          {/* CC button */}
          <button
            data-testid="captions-toggle"
            onClick={() => {
              onToggleCaptions(); // toggles captionsOn state in parent
              resetTimer();
            }}
            title={isYT ? "Captions (reloads player)" : "Toggle narration captions"}
            className={`h-9 px-3 rounded-full text-xs font-bold grid place-items-center transition-colors ${
              captionsOn
                ? "bg-white text-slate-950"
                : "text-white hover:bg-white/10 border border-white/20"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Subtitles className="h-3.5 w-3.5" /> CC
            </div>
          </button>

          {/* Quality selector — YouTube only */}
          {isYT && (
            <div className="relative">
              <button
                onClick={() => { setShowQuality(q => !q); resetTimer(); }}
                title="Video quality"
                className="h-9 px-3 rounded-full text-xs font-bold text-white hover:bg-white/10 border border-white/20 grid place-items-center transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  {/* Gear icon */}
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  {YT_QUALITIES.find(q => q.key === currentQuality)?.label || "Quality"}
                </div>
              </button>

              {/* Quality dropdown */}
              {showQuality && (
                <div className="absolute bottom-12 right-0 bg-slate-900/95 backdrop-blur-md rounded-xl overflow-hidden shadow-2xl border border-white/10 min-w-[130px]">
                  <div className="text-[10px] uppercase tracking-widest text-white/40 px-3 pt-2 pb-1 font-bold">Quality</div>
                  {YT_QUALITIES.map(q => (
                    <button
                      key={q.key}
                      onClick={() => applyQuality(q.key)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-4 ${
                        currentQuality === q.key
                          ? "bg-orange-600 text-white"
                          : "text-white hover:bg-white/10"
                      }`}
                    >
                      {q.label}
                      {currentQuality === q.key && (
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Horizontal strip with left/right arrow scrollers ──────────────────────────
function ScrollStrip({ innerRef, children, testIdPrefix = "strip" }) {
  const fallbackRef = useRef(null);
  const ref = innerRef || fallbackRef;
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line
  }, []);

  // Re-check when children change
  useEffect(() => { update(); /* eslint-disable-next-line */ }, [children]);

  const scrollBy = (dir) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.6), behavior: "smooth" });
  };

  return (
    <div className="relative">
      {canLeft && (
        <button
          type="button"
          data-testid={`${testIdPrefix}-arrow-left`}
          onClick={() => scrollBy(-1)}
          aria-label="Scroll left"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-white shadow-md border border-slate-200 grid place-items-center text-slate-600 hover:text-orange-600 hover:border-orange-300 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {canRight && (
        <button
          type="button"
          data-testid={`${testIdPrefix}-arrow-right`}
          onClick={() => scrollBy(1)}
          aria-label="Scroll right"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-white shadow-md border border-slate-200 grid place-items-center text-slate-600 hover:text-orange-600 hover:border-orange-300 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
      <div
        ref={ref}
        className="flex items-center gap-2 overflow-x-auto scroll-smooth no-scrollbar px-1"
        style={{ scrollbarWidth: "none" }}
      >
        {children}
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function Demo() {
  const nav = useNavigate();
  const { lang, setLang, voiceOn, setVoiceOn, sessionId, demoData, quiz, trackEvent } = useApp();

  const [vidIdx, setVidIdx]                   = useState(0);
  const [markerIdx, setMarkerIdx]             = useState(-1);
  const [activeNarration, setActiveNarration] = useState(null);
  const [playing, setPlaying]                 = useState(true);
  const [tryYourselfMode, setTryYourselfMode] = useState(false);
  const [showTransition, setShowTransition]   = useState(false);
  const [askedTry, setAskedTry]               = useState(false);
  const [maximized, setMaximized]             = useState(false);
  const [chatOpen, setChatOpen]               = useState(true);
  // CC: false = off by default so YouTube starts without captions
  const [captionsOn, setCaptionsOn]           = useState(false);
  const [progress, setProgress]               = useState(0);
  const [duration, setDuration]               = useState(0);

  // End-of-demo flow
  const [endFlow, setEndFlow]           = useState(null);
  const [phone, setPhone]               = useState("");
  const [callbackTime, setCallbackTime] = useState("");
  const [humanNow, setHumanNow]         = useState(false);
  const [crmLoading, setCrmLoading]     = useState(false);
  const [agentLive, setAgentLive]       = useState(false);
  const [chatSize, setChatSize]         = useState("normal"); // kept for compatibility
  const [chatWidth, setChatWidth]       = useState(380);
  const draggingRef = useRef(false);
  const wsRef = useRef(null);

  // Mini-demo state
  const [miniDemoVideo, setMiniDemoVideo] = useState(null);
  const [miniDemoTopic, setMiniDemoTopic] = useState("");
  const userPausedRef                     = useRef(false);

  // Chat
  const [chat, setChat]             = useState([]);
  const [chatInput, setChatInput]   = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [pendingMini, setPendingMini] = useState(null);
  const [agentTyping, setAgentTyping] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState(null);

  // Track questions for CRM
  const [questionsAsked, setQuestionsAsked] = useState([]);

  const videoRef        = useRef(null);
  const ytPlayerRef     = useRef(null);
  const ytContainerRef  = useRef(null);
  const ytIntervalRef   = useRef(null);
  const playerRef       = useRef(null);
  const chatEndRef      = useRef(null);
  const moduleStripRef  = useRef(null);
  const chapterStripRef = useRef(null);
  const isSeekingRef    = useRef(false); // prevents poller from fighting seeks

  useEffect(() => { if (!demoData) nav("/quiz"); /* eslint-disable-next-line */ }, []);
  useEffect(() => { trackEvent("demo_started"); /* eslint-disable-next-line */ }, []);
  useEffect(() => { voice.setEnabled(voiceOn); }, [voiceOn]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  // WebSocket for real-time agent events
  useEffect(() => {
    if (!sessionId) return;
    const backendBase = process.env.REACT_APP_BACKEND_URL || window.location.origin;
    const wsBase = backendBase.replace(/^http/i, "ws");
    const url = `${wsBase}/api/ws/live/session:${sessionId}`;
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === 'agent_joined') {
            setAgentLive(true);
            if (data.lead?.id) setActiveLeadId(data.lead.id);
            setChat(c => [...c, { _id: `sys_${Date.now()}`, role: 'system', text: `Agent ${data.agent?.name || 'Support'} joined the chat.` }]);
          }
          // Only process agent messages — user messages are added optimistically
          if (data.type === 'new_message' && data.message && data.message.role === 'agent') {
            const m = data.message;
            setChat(c => {
              if (c.some(x => x._id === m.id)) return c;
              return [...c, { _id: m.id, role: 'agent', text: m.text, created_at: m.created_at }];
            });
          }
          if (data.type === 'typing' && data.from === 'agent') {
            setAgentTyping(true);
            setTimeout(() => setAgentTyping(false), 2000);
          }
          if (data.type === 'agent_left') {
            setAgentLive(false);
            setActiveLeadId(null);
            setChat(c => [...c, { _id: `sys_end_${Date.now()}`, role: 'system', text: 'Support session ended. You can continue with our AI assistant.' }]);
          }
        } catch (e) {}
      };
      ws.onclose = () => {};
      ws.onerror = () => {};
    } catch (e) {}
    return () => { if (wsRef.current) { try { wsRef.current.close(); } catch (e) {} } };
  }, [sessionId]);

  // Poll agent messages every 2s — simple ID dedup, no time filtering
  useEffect(() => {
    if (!agentLive || !activeLeadId) return;
    const poll = async () => {
      try {
        const r = await api.get(`/live-leads/${activeLeadId}/messages`);
        const agentMsgs = (r.data || []).filter(m => m.role === 'agent');
        setChat(c => {
          const existingIds = new Set(c.map(m => m._id).filter(Boolean));
          const newMsgs = agentMsgs
            .filter(m => !existingIds.has(m.id))
            .map(m => ({ _id: m.id, role: 'agent', text: m.text, created_at: m.created_at }));
          if (!newMsgs.length) return c;
          return [...c, ...newMsgs].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        });
      } catch (e) {}
    };
    poll();
    const iv = setInterval(poll, 2000);
    return () => clearInterval(iv);
  }, [agentLive, activeLeadId]);

  // Monitor lead status — reset agentLive when agent closes the session
  useEffect(() => {
    if (!agentLive || !activeLeadId) return;
    const checkStatus = async () => {
      try {
        const r = await api.get(`/live-leads/${activeLeadId}`);
        const s = r.data?.status;
        if (s === 'closed' || s === 'resolved' || s === 'completed') {
          setAgentLive(false);
          setActiveLeadId(null);
          setChat(c => [...c, {
            _id: `sys_end_${Date.now()}`,
            role: 'system',
            text: 'Support session ended. You can continue with our AI assistant.'
          }]);
        }
      } catch (e) {}
    };
    const iv = setInterval(checkStatus, 8000);
    return () => clearInterval(iv);
  }, [agentLive, activeLeadId]);

  // REST fallback — detect agent joining every 5s in case WS missed it
  useEffect(() => {
    if (agentLive || !sessionId) return;
    const checkForAgent = async () => {
      try {
        const r = await api.get(`/live-leads/session/${sessionId}`);
        const s = r.data?.status;
        if ((s === 'active' || s === 'in_session' || s === 'assigned') && r.data?.id) {
          setAgentLive(true);
          setActiveLeadId(r.data.id);
        }
      } catch (e) {}
    };
    checkForAgent();
    const iv = setInterval(checkForAgent, 5000);
    return () => clearInterval(iv);
  }, [agentLive, sessionId]);

  // Center active module chip
  useEffect(() => {
    const strip = moduleStripRef.current;
    if (!strip) return;
    const active = strip.querySelector(`[data-testid="module-chip-${vidIdx}"]`);
    if (!active) return;
    const target = active.offsetLeft - (strip.clientWidth / 2) + (active.clientWidth / 2);
    strip.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [vidIdx]);

  const videos       = demoData?.videos || [];
  const mainVideo    = videos[vidIdx];
  const currentVideo = miniDemoVideo || mainVideo;
  const markers      = ((currentVideo?.markers) || []).slice().sort((a, b) => a.timestamp - b.timestamp);
  const inMiniDemo   = !!miniDemoVideo;

  const chapters = currentVideo?.chapters || [];
  const activeChapterIdx = (() => {
    if (!chapters.length) return -1;
    for (let i = chapters.length - 1; i >= 0; i--) {
      const ch    = chapters[i];
      const start = ch.start || 0;
      const end   = ch.end != null ? ch.end : Infinity;
      if (progress >= start && progress < end) return i;
    }
    if (progress >= (chapters[chapters.length - 1].start || 0)) return chapters.length - 1;
    return -1;
  })();

  // Auto-center active chapter chip
  useEffect(() => {
    const strip = chapterStripRef.current;
    if (!strip || activeChapterIdx < 0) return;
    const active = strip.querySelector(`[data-testid="chapter-chip-${activeChapterIdx}"]`);
    if (!active) return;
    const target = active.offsetLeft - (strip.clientWidth / 2) + (active.clientWidth / 2);
    strip.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [activeChapterIdx]);

  const isYT          = isYouTube(currentVideo?.video_url || "");
  const currentMarker = markerIdx >= 0 ? markers[markerIdx] : null;
  const activeMarker  = currentMarker && (currentMarker.end_time == null || progress <= currentMarker.end_time + 0.2)
    ? currentMarker : null;

  // Listen for executive callback from AI chat
  useEffect(() => {
    const handler = () => setEndFlow("callback");
    window.addEventListener("biz-open-callback", handler);
    return () => window.removeEventListener("biz-open-callback", handler);
  }, []);

  const biziverseUrl = (currentMarker && currentMarker.biziverse_url) || currentVideo?.biziverse_url || "https://biziverse.com";

  // Apply voice/mute toggle
  useEffect(() => {
    if (isYT && ytPlayerRef.current) {
      try {
        if (voiceOn) ytPlayerRef.current.unMute?.(); else ytPlayerRef.current.mute?.();
      } catch (e) {}
    }
    if (!isYT && videoRef.current) {
      videoRef.current.muted = !voiceOn;
    }
    voice.setEnabled(false);
  }, [voiceOn, isYT, currentVideo?.id]);

  // Player abstraction
  const doPlay        = () => { isYT ? ytPlayerRef.current?.playVideo?.()  : videoRef.current?.play().catch(() => {}); };
  const doPause       = () => { isYT ? ytPlayerRef.current?.pauseVideo?.() : videoRef.current?.pause(); };
  const doSeek        = (t) => { isYT ? ytPlayerRef.current?.seekTo?.(t, true) : (videoRef.current && (videoRef.current.currentTime = t)); };
  const doGetTime     = () => isYT ? (ytPlayerRef.current?.getCurrentTime?.() || 0) : (videoRef.current?.currentTime || 0);
  const doGetDuration = () => isYT ? (ytPlayerRef.current?.getDuration?.()    || 0) : (videoRef.current?.duration    || 0);
  const doIsPaused    = () => isYT ? (ytPlayerRef.current?.getPlayerState?.() !== 1) : (videoRef.current?.paused ?? true);

  // ── Initialize YouTube player ──
  // captionsOn is a dependency so toggling CC reinitializes the player
  // with the correct cc_load_policy — the only reliable way to toggle YT captions
  useEffect(() => {
    if (!currentVideo) return;
    if (!isYT) {
      if (ytPlayerRef.current) { try { ytPlayerRef.current.destroy(); } catch (e) {} ytPlayerRef.current = null; }
      return;
    }
    let cancelled = false;
    const primary          = (currentVideo.primary_language || "").toLowerCase();
    const needsTranslation = primary && lang && primary !== lang;

    loadYouTubeAPI().then(YT => {
      if (cancelled || !ytContainerRef.current) return;
      const vid = extractYouTubeId(currentVideo.video_url);
      if (ytPlayerRef.current) { try { ytPlayerRef.current.destroy(); } catch (e) {} }

      const pv = {
        autoplay:       1,
        controls:       0,   // hide YouTube's own controls — we use ours
        modestbranding: 1,
        rel:            0,
        playsinline:    1,
        fs:             0,
        disablekb:      1,
        vq:             "hd1080",
        hd:             1,
        hl:             lang,
        iv_load_policy: 3,   // hide annotations
        // KEY: cc_load_policy 0 = captions OFF, 1 = captions ON
        // This is the only reliable way to control YT captions
        cc_load_policy: captionsOn ? 1 : 0,
        start: currentVideo._kb_start ? Math.floor(currentVideo._kb_start) : 0,
      };

      if (needsTranslation) {
        pv.cc_load_policy = 1;          // force on for translation
        pv.cc_lang_pref   = lang;
      }

      ytPlayerRef.current = new YT.Player(ytContainerRef.current, {
        videoId: vid,
        playerVars: pv,
        events: {
          onReady: (e) => {
            try {
              e.target.setPlaybackQuality?.("hd1080");
              e.target.playVideo();
              if (currentVideo._kb_start) e.target.seekTo(currentVideo._kb_start, true);
              if (needsTranslation) {
                try { e.target.loadModule?.("captions"); } catch (_) {}
                setTimeout(() => {
                  try { e.target.setOption?.("captions", "track", { languageCode: lang }); } catch (_) {}
                  try { e.target.setOption?.("captions", "reload", { tlang: lang }); } catch (_) {}
                }, 800);
              }
            } catch (err) {}
            setDuration(e.target.getDuration() || 0);
          },
          onStateChange: (e) => {
            if (e.data === 1) {
              setPlaying(true);
              try { e.target.setPlaybackQuality?.("hd1080"); } catch (err) {}
            } else if (e.data === 2) {
              setPlaying(false);
            } else if (e.data === 0) {
              if (inMiniDemo) exitMiniDemo();
              else if (vidIdx + 1 < videos.length) {
                setShowTransition(true);
                setTimeout(() => { setShowTransition(false); setVidIdx(i => i + 1); setMarkerIdx(-1); }, 1600);
              } else {
                trackEvent("demo_ended");
                setEndFlow("choose");
                voice.stop();
              }
            }
          }
        }
      });
    });
    return () => { cancelled = true; };
    // captionsOn included so player reinits when CC is toggled
    // eslint-disable-next-line
  }, [currentVideo?.id, isYT, lang, captionsOn]);

  // ── Unified time + marker poller ──
  useEffect(() => {
    if (!currentVideo || tryYourselfMode) return;
    if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
    ytIntervalRef.current = setInterval(() => {
      // Skip tick while a seek is in progress — prevents poller fighting seeks
      if (isSeekingRef.current) return;

      const t = doGetTime();
      const d = doGetDuration();
      setProgress(t);
      if (d && Math.abs(d - duration) > 0.5) setDuration(d);

      if (inMiniDemo && currentVideo?._kb_end && t >= currentVideo._kb_end) {
        exitMiniDemo();
        return;
      }
      if (markerIdx + 1 < markers.length && t >= markers[markerIdx + 1].timestamp) {
        const nextIdx = markerIdx + 1;
        setMarkerIdx(nextIdx);
        triggerMarker(markers[nextIdx]);
      }
    }, 400);
    return () => { if (ytIntervalRef.current) clearInterval(ytIntervalRef.current); };
    // eslint-disable-next-line
  }, [markerIdx, markers, tryYourselfMode, currentVideo?.id, isYT]);

  // MP4-only ended listener
  useEffect(() => {
    if (isYT) return;
    const v = videoRef.current; if (!v) return;
    const onEnd = () => {
      if (inMiniDemo) exitMiniDemo();
      else if (vidIdx + 1 < videos.length) {
        setShowTransition(true);
        setTimeout(() => { setShowTransition(false); setVidIdx(i => i + 1); setMarkerIdx(-1); }, 1600);
      } else { trackEvent("demo_ended"); setEndFlow("choose"); voice.stop(); }
    };
    v.addEventListener("ended", onEnd);
    return () => v.removeEventListener("ended", onEnd);
    // eslint-disable-next-line
  }, [vidIdx, videos.length, inMiniDemo, isYT]);

  useEffect(() => {
    if (isYT) return;
    if (videoRef.current && playing && !tryYourselfMode) videoRef.current.play().catch(() => {});
  }, [vidIdx, playing, tryYourselfMode, currentVideo, isYT]);

  const triggerMarker = (m) => {
    doPause();
    const text = m.narration?.[lang] || m.narration?.en || "";
    setActiveNarration({ text, marker: m });
    const wait = Math.max((m.pause_duration || 3) * 1000, 1000);
    setTimeout(() => {
      setActiveNarration(null);
      if (userPausedRef.current) return;
      if (!tryYourselfMode) {
        doPlay();
        setPlaying(true);
        if (!askedTry && markerIdx >= 1 && !inMiniDemo) {
          setAskedTry(true);
          setChat(c => [...c, { role: "ai", text: t(lang, "want_try"), prompt: "want_try" }]);
        }
      }
    }, wait);
  };

  const togglePlay = () => {
    if (doIsPaused()) {
      userPausedRef.current = false;
      doPlay();
      setPlaying(true);
    } else {
      userPausedRef.current = true;
      doPause();
      setPlaying(false);
      voice.stop();
      setActiveNarration(null);
    }
  };

  // ── Skip seconds — with seek lock ──
  const skipSeconds = (delta) => {
    voice.stop();
    setActiveNarration(null);
    const newT = Math.max(0, Math.min(doGetTime() + delta, doGetDuration() || 99999));

    isSeekingRef.current = true;
    setProgress(newT);
    doSeek(newT);

    let newIdx = -1;
    for (let i = 0; i < markers.length; i++) if (markers[i].timestamp <= newT) newIdx = i;
    setMarkerIdx(newIdx);

    if (!userPausedRef.current) doPlay();
    setTimeout(() => { isSeekingRef.current = false; }, 600);
  };

  const jumpToModule = (idx) => {
    if (idx < 0 || idx >= videos.length || idx === vidIdx) return;
    voice.stop();
    setActiveNarration(null);
    setVidIdx(idx);
    setMarkerIdx(-1);
  };

  const tryYourself = () => {
    if (ytPlayerRef.current) { try { ytPlayerRef.current.pauseVideo?.(); } catch (e) {} }
    voice.stop();
    setTryYourselfMode(true);
    trackEvent("interactive_mode_entered");
  };

  const exitTryYourself = () => {
    setTryYourselfMode(false);
    setPlaying(true);
    setTimeout(() => doPlay(), 200);
    trackEvent("demo_resumed");
  };

  const playKBVideo = (videoUrl, topic = "", start = 0, end = null) => {
    if (!videoUrl) return;
    voice.stop();
    doPause();
    setMiniDemoVideo({
      id: `kb_${Date.now()}`,
      title: topic || "Demo",
      video_url: videoUrl,
      markers: [],
      chapters: [],
      _kb_start: start || 0,
      _kb_end: end || null
    });
    setMiniDemoTopic(topic);
    setMarkerIdx(-1);
    setActiveNarration(null);
    userPausedRef.current = false;
    setPendingMini(null);
    trackEvent("kb_video_played", { topic, videoUrl });
  };

  const exitMiniDemo = () => {
    voice.stop();
    setMiniDemoVideo(null);
    setMiniDemoTopic("");
    setMarkerIdx(-1);
    setActiveNarration(null);
    userPausedRef.current = false;
    setPlaying(true);
    trackEvent("mini_demo_exited");
  };

  // ── Send chat message ──
  // When agent joins, resolve the live_lead_id so we can mirror user messages to the agent
  useEffect(() => {
    if (!agentLive || activeLeadId || !sessionId) return;
    (async () => {
      try {
        const r = await api.get(`/live-leads/session/${sessionId}`);
        if (r.data?.id) setActiveLeadId(r.data.id);
      } catch (e) {}
    })();
  }, [agentLive, activeLeadId, sessionId]);

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const q = chatInput.trim();
    setQuestionsAsked(prev => [...new Set([...prev, q])]);
    const tempId = `user_${Date.now()}`;
    setChat(c => [...c, { _id: tempId, role: "user", text: q }]);
    setChatInput("");

    // If a human agent is live on this session, route ONLY to agent — never to AI
    if (agentLive) {
      let leadId = activeLeadId;
      if (!leadId) {
        // Fallback: try to fetch lead ID inline (in case WS payload was missed)
        try {
          const r = await api.get(`/live-leads/session/${sessionId}`);
          if (r.data?.id) { setActiveLeadId(r.data.id); leadId = r.data.id; }
        } catch (e) {}
      }
      if (leadId) {
        try {
          await api.post(`/live-leads/${leadId}/messages`, { role: "user", type: "text", text: q });
        } catch (e) { console.error("Failed to send to agent", e); }
      }
      return; // Always return — never fall through to AI when agent is live
    }

    setChatLoading(true);
    if (!tryYourselfMode) doPause();
    voice.stop();
    try {
      const r = await api.post("/ai/chat", {
        session_id: sessionId, message: q, language: lang,
        business_type: quiz?.bt, product_category: quiz?.pc,
        modules: quiz?.mods || [], current_step: vidIdx
      });
      const ans        = r.data.answer || "";
      const videoUrl   = r.data.video_url;
      const noAnswer   = r.data.no_answer;
      const clarify    = r.data.clarify;
      const candidates = r.data.candidates || [];
      const msg = { role: "ai", text: ans };
      if (noAnswer) msg.exec_cta = true;
      if (clarify && candidates.length) { msg.clarify = true; msg.candidates = candidates; }
      setChat(c => [...c, msg]);
      if (videoUrl) {
        setPendingMini({ video_url: videoUrl, topic: q, start: r.data.video_start, end: r.data.video_end });
        setChat(c => [...c, {
          role: "ai", text: "Want me to show you how this works?", prompt: "show_me",
          video_url: videoUrl, topic: q, video_start: r.data.video_start, video_end: r.data.video_end
        }]);
      } else if (!noAnswer && !clarify) {
        if (!tryYourselfMode && playing) doPlay();
      }
    } catch (e) {
      setChat(c => [...c, { role: "ai", text: "I'm having trouble answering right now. Please try again." }]);
    }
    setChatLoading(false);
  };

  // ── Clarify candidate picked ──
  const pickClarifyCandidate = (cand) => {
    setChatInput("");
    setQuestionsAsked(prev => [...new Set([...prev, cand.question])]);
    setChat(c => [...c, { role: "user", text: cand.question }]);
    setChatLoading(true);
    (async () => {
      try {
        const r = await api.post("/ai/chat", {
          session_id: sessionId, message: cand.question, language: lang,
          business_type: quiz?.bt, product_category: quiz?.pc,
          modules: quiz?.mods || [], current_step: vidIdx
        });
        const ans        = r.data.answer || "";
        const videoUrl   = r.data.video_url;
        const noAnswer   = r.data.no_answer;
        const clarify    = r.data.clarify;
        const candidates = r.data.candidates || [];
        const msg = { role: "ai", text: ans };
        if (noAnswer) msg.exec_cta = true;
        if (clarify && candidates.length) { msg.clarify = true; msg.candidates = candidates; }
        setChat(c => [...c, msg]);
        if (videoUrl) {
          setPendingMini({ video_url: videoUrl, topic: cand.question, start: r.data.video_start, end: r.data.video_end });
          setChat(c => [...c, {
            role: "ai", text: "Want me to show you how this works?", prompt: "show_me",
            video_url: videoUrl, topic: cand.question, video_start: r.data.video_start, video_end: r.data.video_end
          }]);
        }
      } catch (e) {
        setChat(c => [...c, { role: "ai", text: "I'm having trouble answering right now. Please try again." }]);
      }
      setChatLoading(false);
    })();
  };

  const acceptShowMe  = (m) => playKBVideo(m.video_url, m.topic, m.video_start, m.video_end);
  const declineShowMe = () => {
    setPendingMini(null);
    setChat(c => c.filter(m => m.prompt !== "show_me"));
    if (!tryYourselfMode) { doPlay(); setPlaying(true); }
  };

  // ── Submit callback → push lead to Biziverse CRM ──
  const submitCallback = async () => {
    setCrmLoading(true);
    trackEvent("callback_requested", { phone, callbackTime, human_now: humanNow });
    try {
      await api.post("/callback/request", {
        phone,
        callback_time:    callbackTime,
        human_now:        humanNow,
        session_id:       sessionId,
        business_type:    quiz?.bt,
        product_category: quiz?.pc,
        modules_watched:  videos.map(v => v.title),
        questions_asked:  questionsAsked,
        language:         lang,
      });
    } catch (e) {
      console.error("CRM push failed:", e);
      // Don't block UX — show confirmation regardless
    }
    setCrmLoading(false);
    setEndFlow("callback_confirm");
  };

  const transitionLabel = videos[vidIdx + 1]?.title || "";

  // ── Seek handler used by ControlsBar timeline click and chapter chips ──
  const handleSeek = (targetTime) => {
    isSeekingRef.current = true;
    setProgress(targetTime);

    if (!isYT && videoRef.current) {
      videoRef.current.currentTime = targetTime;
      if (!userPausedRef.current) {
        videoRef.current.play().catch(() => {});
        setPlaying(true);
      }
    } else {
      doSeek(targetTime);
      if (!userPausedRef.current) {
        setTimeout(() => { ytPlayerRef.current?.playVideo?.(); setPlaying(true); }, 300);
      }
    }

    let newIdx = -1;
    for (let i = 0; i < markers.length; i++) if (markers[i].timestamp <= targetTime) newIdx = i;
    setMarkerIdx(newIdx);
    setActiveNarration(null);
    voice.stop();

    setTimeout(() => { isSeekingRef.current = false; }, 600);
  };

  return (
    <div className={maximized ? "fixed inset-0 bg-black z-50" : "min-h-screen bg-slate-100"}>

      {/* ── Top bar ── */}
      {!maximized && (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Button data-testid="demo-back" variant="ghost" size="sm" onClick={() => { voice.stop(); nav("/quiz"); }} className="text-slate-600 px-2 sm:px-3">
                <ArrowLeft className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">{t(lang, "back")}</span>
              </Button>
              <img src="https://biziverse.com/WebExt/img/logo2.jpg" alt="Biziverse" className="h-6 sm:h-7 w-auto" />
              <span className="hidden sm:inline text-xs uppercase tracking-widest text-orange-600 font-bold border-l pl-3">Live Demo</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
              <div className="hidden md:flex items-center text-xs text-slate-500 mr-2">
                {currentVideo?.title}{inMiniDemo && " · Showing answer"}
              </div>
              <select
                data-testid="demo-lang-select"
                value={lang}
                onChange={e => setLang(e.target.value)}
                className="text-xs sm:text-sm border border-slate-200 rounded-full px-2 sm:px-3 py-1 sm:py-1.5 bg-white"
              >
                {LANGS.map(l => <option key={l.code} value={l.code}>{l.native}</option>)}
              </select>
              <Button data-testid="voice-toggle" variant="outline" size="sm" onClick={() => setVoiceOn(v => !v)} className="px-2 sm:px-3">
                {voiceOn ? <Volume2 className="h-4 w-4 sm:mr-1.5" /> : <VolumeX className="h-4 w-4 sm:mr-1.5" />}
                <span className="hidden sm:inline">{voiceOn ? "Sound On" : "Muted"}</span>
              </Button>
              <Button data-testid="end-demo" variant="ghost" size="sm" onClick={() => { voice.stop(); setEndFlow("choose"); }} className="px-2 sm:px-3 text-xs sm:text-sm">
                <span className="hidden sm:inline">End demo</span>
                <span className="sm:hidden">End</span>
              </Button>
            </div>
          </div>
        </header>
      )}

      <main className={maximized ? "h-screen w-screen relative" : "max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-8 py-4 lg:py-6 grid lg:grid-cols-12 gap-4 lg:gap-6"}>

        {/* ── Video column ── */}
        <div className={maximized ? "h-full w-full" : "lg:col-span-8"}>
          <div
            ref={playerRef}
            className={`relative bg-black overflow-hidden ${maximized ? "w-full h-full" : "rounded-2xl shadow-2xl border border-slate-200 aspect-video"}`}
          >
            {/* YT player — always mounted to avoid removeChild errors */}
            {isYT && !tryYourselfMode && (
              <div className="absolute inset-0 pointer-events-none" data-testid="yt-wrap">
                <div ref={ytContainerRef} className="w-full h-full" />
              </div>
            )}
            {isYT && tryYourselfMode && (
              <div style={{ display: "none" }}><div ref={ytContainerRef} /></div>
            )}

            {/* Try Yourself iframe */}
            {tryYourselfMode ? (
              <div className="absolute inset-0 overflow-hidden bg-white z-10">
                <iframe
                  data-testid="biziverse-iframe"
                  src={biziverseUrl}
                  title="Biziverse"
                  style={{ width: "142%", height: "142%", transform: "scale(0.7)", transformOrigin: "top left", border: 0 }}
                  className="bg-white"
                />
              </div>
            ) : !isYT && currentVideo && (
              <video
                ref={videoRef}
                data-testid="demo-video"
                src={currentVideo.video_url}
                className="w-full h-full object-cover"
                playsInline autoPlay preload="auto"
              />
            )}

            {/* Highlight overlay */}
            {activeMarker?.highlight && !tryYourselfMode && (
              <div className="demo-highlight" style={{
                left: `${activeMarker.highlight.x}%`, top: `${activeMarker.highlight.y}%`,
                width: `${activeMarker.highlight.w}%`, height: `${activeMarker.highlight.h}%`,
                borderRadius: activeMarker.highlight.shape === "circle" ? "50%" : "12px"
              }} />
            )}

            {/* Cursor overlay */}
            {activeMarker?.cursor && !tryYourselfMode && (
              <div className="demo-cursor" style={{ left: `${activeMarker.cursor.x}%`, top: `${activeMarker.cursor.y}%` }} />
            )}

            {/* Narration caption — shown for MP4 always, shown for YT only when captionsOn */}
            {activeNarration && (captionsOn || !isYT) && !tryYourselfMode && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-20 max-w-2xl px-5 py-3 bg-slate-950/85 backdrop-blur-md text-white rounded-2xl shadow-2xl z-30 border border-white/10">
                <div className="flex items-start gap-2">
                  <div className="h-6 w-6 rounded-full bg-orange-600 grid place-items-center flex-shrink-0 mt-0.5">
                    <Sparkles className="h-3 w-3" />
                  </div>
                  <div className="text-sm leading-relaxed">{activeNarration.text}</div>
                </div>
              </div>
            )}

            {/* Module chip */}
            {!tryYourselfMode && currentVideo && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
                <div className="px-4 py-1.5 bg-slate-950/70 backdrop-blur-md text-white rounded-full text-xs font-bold tracking-wider uppercase border border-white/10 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                  {inMiniDemo ? (miniDemoTopic || currentVideo.title) : currentVideo.title}
                </div>
              </div>
            )}

            {/* Mini-demo return */}
            {inMiniDemo && !tryYourselfMode && (
              <button
                data-testid="exit-mini-demo"
                onClick={exitMiniDemo}
                className="absolute top-4 left-4 z-30 h-10 px-4 rounded-full bg-white/95 hover:bg-white text-slate-950 grid place-items-center shadow-lg border border-white/30 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-bold">
                  <ArrowLeft className="h-4 w-4" /> Return to Demo
                </span>
              </button>
            )}

            {/* Try Yourself return */}
            {tryYourselfMode && (
              <button
                data-testid="exit-try-yourself"
                onClick={exitTryYourself}
                title="Return to demo"
                className="absolute top-4 left-4 z-30 h-10 w-10 rounded-full bg-orange-600/80 hover:bg-orange-600 backdrop-blur-md text-white grid place-items-center border border-white/20 shadow-lg transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}

            {/* Maximize / Minimize */}
            <button
              onClick={() => setMaximized(m => !m)}
              data-testid="toggle-maximize"
              className="absolute top-4 right-4 z-30 h-10 w-10 rounded-full bg-slate-950/70 hover:bg-slate-950 text-white grid place-items-center shadow-lg"
            >
              {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            {/* Transition overlay */}
            {showTransition && (
              <div className="absolute inset-0 bg-secondary/95 grid place-items-center z-40">
                <div className="text-center fade-up">
                  <div className="text-xs uppercase tracking-widest text-amber-300 font-bold">{t(lang, "now_showing")}</div>
                  <div className="font-display text-3xl sm:text-5xl font-black text-white mt-2">{transitionLabel}</div>
                </div>
              </div>
            )}

            {/* ── Controls bar ── */}
            {!tryYourselfMode && currentVideo && (
              <ControlsBar
                progress={progress}
                duration={duration}
                playing={playing}
                captionsOn={captionsOn}
                onSeek={(p) => handleSeek(p * (duration || 0))}
                onTogglePlay={togglePlay}
                onSkip={skipSeconds}
                onToggleCaptions={() => setCaptionsOn(c => !c)}
                isYT={isYT}
                ytPlayerRef={ytPlayerRef}
              />
            )}
          </div>

          {/* Module timeline strip */}
          {!maximized && !tryYourselfMode && !inMiniDemo && videos.length > 1 && (
            <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-3">
              <ScrollStrip innerRef={moduleStripRef} testIdPrefix="module-strip">
                {videos.map((v, i) => (
                  <button
                    key={v.id}
                    data-testid={`module-chip-${i}`}
                    onClick={() => jumpToModule(i)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      i === vidIdx
                        ? "bg-orange-600 text-white ring-2 ring-orange-300"
                        : i < vidIdx
                        ? "bg-slate-100 text-slate-500 line-through"
                        : "bg-slate-100 text-slate-700 hover:bg-orange-50"
                    }`}
                  >
                    <span className="opacity-60 mr-1">{i + 1}.</span>{v.title}
                  </button>
                ))}
              </ScrollStrip>
            </div>
          )}

          {/* Chapters strip */}
          {!maximized && !tryYourselfMode && chapters.length > 0 && (
            <div className="mt-3 bg-white border border-slate-200 rounded-2xl p-3">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">Chapters</div>
              <ScrollStrip innerRef={chapterStripRef} testIdPrefix="chapter-strip">
                {chapters.map((ch, i) => {
                  const isActive = i === activeChapterIdx;
                  return (
                    <button
                      key={i}
                      data-testid={`chapter-chip-${i}`}
                      onClick={() => handleSeek(ch.start || 0)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs border text-center transition-colors ${
                        isActive
                          ? "bg-orange-600 text-white border-orange-700 shadow-sm ring-2 ring-orange-300"
                          : "bg-slate-50 hover:bg-orange-50 border-slate-200 text-slate-700 hover:border-orange-300"
                      }`}
                    >
                      <div className={`font-bold ${isActive ? "text-white" : "text-secondary"}`}>{ch.name}</div>
                      <div className={`text-[10px] font-mono ${isActive ? "text-white/80" : "text-slate-400"}`}>
                        {fmtTime(ch.start || 0)}{ch.end ? ` – ${fmtTime(ch.end)}` : ""}
                      </div>
                    </button>
                  );
                })}
              </ScrollStrip>
            </div>
          )}

          {/* Try Yourself button */}
          {!maximized && !tryYourselfMode && !inMiniDemo && (currentVideo?.show_try_yourself !== false) && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button data-testid="try-yourself" onClick={tryYourself} className="bg-secondary hover:bg-secondary/90 text-white rounded-full">
                <ExternalLink className="h-4 w-4 mr-2" /> {t(lang, "try_yourself")}
              </Button>
              <div className="flex-1" />
              <div className="text-sm text-slate-500">Step {vidIdx + 1} of {videos.length}</div>
            </div>
          )}
        </div>

        {/* ── AI Chat sidebar (desktop) / floating drawer (mobile + maximized) ── */}
        {!maximized && (
          <aside
            className="hidden lg:flex lg:col-span-4 bg-white border border-slate-200 rounded-2xl flex-col h-[calc(100vh-100px)] sticky top-[72px] overflow-hidden"
            style={{ width: chatWidth, minWidth: 260, maxWidth: 900 }}
            data-testid="chat-sidebar-desktop"
          >
            <div className="relative">
              <div style={{ position: 'absolute', left: -8, top: 0, bottom: 0, width: 16, cursor: 'ew-resize' }}
                   onMouseDown={(e) => { draggingRef.current = true; e.preventDefault(); }}
                   onDoubleClick={() => setChatWidth(380)}
                   onMouseUp={() => { draggingRef.current = false; }}
                   onMouseMove={(e) => {
                     if (!draggingRef.current) return;
                     const rect = e.currentTarget.parentElement.getBoundingClientRect();
                     const newW = window.innerWidth - e.clientX - 32;
                     if (newW >= 260 && newW <= 900) setChatWidth(newW);
                   }}
              />
            </div>
            <ChatHeader lang={lang} agentLive={agentLive} setChatOpen={setChatOpen} />
            <ChatBody
              chat={chat} chatLoading={chatLoading} chatEndRef={chatEndRef} lang={lang}
              onAccept={acceptShowMe} onDecline={declineShowMe} onClarifyPick={pickClarifyCandidate}
              agentTyping={agentTyping}
            />
            <ChatInput lang={lang} chatInput={chatInput} setChatInput={setChatInput} send={sendChat} wsRef={wsRef} />
          </aside>
        )}

        {/* Mobile + maximized: floating chat drawer */}
        {chatOpen ? (
          <div
            className={`fixed z-50 bg-white border border-slate-200 shadow-2xl flex flex-col
                        inset-x-3 bottom-3 top-16 rounded-2xl
                        sm:inset-x-4 sm:bottom-4 sm:top-20
                        ${maximized ? "lg:bottom-6 lg:right-6 lg:left-auto lg:top-auto lg:w-96 lg:h-[520px] lg:inset-x-auto" : "lg:hidden"}`}
            data-testid="chat-drawer-mobile"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full grid place-items-center ${agentLive ? 'bg-emerald-100' : 'bg-orange-100'}`}>
                  {agentLive
                    ? <UserCheck className="h-4 w-4 text-emerald-600" />
                    : <Sparkles className="h-4 w-4 text-orange-600" />
                  }
                </div>
                <div>
                  <div className="font-display font-bold text-secondary text-sm">{agentLive ? 'Live Support' : 'Biziverse AI'}</div>
                  <div className={`text-[11px] flex items-center gap-1.5 ${agentLive ? 'text-emerald-600' : 'text-slate-500'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${agentLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                    {agentLive ? 'Agent is online' : 'AI assistant'}
                  </div>
                </div>
              </div>
              <button onClick={() => setChatOpen(false)} data-testid="close-chat-drawer" className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ChatBody
              chat={chat} chatLoading={chatLoading} chatEndRef={chatEndRef} lang={lang}
              onAccept={acceptShowMe} onDecline={declineShowMe} onClarifyPick={pickClarifyCandidate}
              agentTyping={agentTyping}
            />
            <ChatInput lang={lang} chatInput={chatInput} setChatInput={setChatInput} send={sendChat} wsRef={wsRef} />
          </div>
        ) : (
          <button
            data-testid="open-chat-bubble"
            onClick={() => setChatOpen(true)}
            className={`fixed bottom-5 right-5 h-14 w-14 rounded-full bg-orange-600 hover:bg-orange-700 text-white shadow-2xl shadow-orange-500/40 grid place-items-center z-50 ${maximized ? "" : "lg:hidden"}`}
          >
            <MessageCircle className="h-6 w-6" />
          </button>
        )}
      </main>

      {/* ── End-of-demo modal ── */}
      {endFlow && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[60] grid place-items-center p-6" data-testid="end-flow-modal">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl relative">
            <button
              data-testid="end-flow-close"
              onClick={() => { setEndFlow(null); if (!tryYourselfMode && playing) doPlay(); }}
              aria-label="Close"
              className="absolute top-3 right-3 h-9 w-9 rounded-full grid place-items-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>

            {endFlow === "choose" && (
              <>
                <div className="text-xs uppercase tracking-widest text-orange-600 font-bold">Demo complete</div>
                <h2 className="font-display text-3xl font-black text-secondary mt-2">What would you like next?</h2>
                <p className="text-slate-500 text-sm mt-2">Pick an option to continue.</p>
                <div className="grid gap-2 mt-6">
                  <button
                    data-testid="ef-explore"
                    onClick={() => { setEndFlow(null); setVidIdx(0); setMarkerIdx(-1); setTimeout(() => doPlay(), 300); }}
                    className="text-left p-4 rounded-xl border-2 border-slate-200 hover:border-orange-300 bg-white transition-colors"
                  >
                    <div className="font-display font-bold text-secondary">Explore the demo again</div>
                    <div className="text-xs text-slate-500">Restart from the first module</div>
                  </button>
                  <button
                    data-testid="ef-offers"
                    onClick={() => { setEndFlow("offers"); trackEvent("offers_selected"); }}
                    className="text-left p-4 rounded-xl border-2 border-orange-500 bg-orange-50 transition-colors"
                  >
                    <div className="font-display font-bold text-orange-700">Proceed to offers & get full access</div>
                    <div className="text-xs text-slate-600">Grab your plan and start using Biziverse</div>
                  </button>
                  <button
                    data-testid="ef-callback"
                    onClick={() => { setEndFlow("callback"); setHumanNow(false); trackEvent("callback_selected"); }}
                    className="text-left p-4 rounded-xl border-2 border-slate-200 hover:border-slate-300 bg-white transition-colors"
                  >
                    <div className="font-display font-bold text-secondary">Talk with an executive</div>
                    <div className="text-xs text-slate-500">Schedule a call-back from our team</div>
                  </button>
                </div>
                <button onClick={() => setEndFlow(null)} className="mt-4 text-xs text-slate-400 hover:text-slate-600">Close</button>
              </>
            )}

            {endFlow === "offers" && (
              <>
                <div className="text-xs uppercase tracking-widest text-orange-600 font-bold">Get started</div>
                <h2 className="font-display text-3xl font-black text-secondary mt-2">Enter your mobile number</h2>
                <p className="text-slate-500 text-sm mt-1">We'll take you to the offers page to complete your signup.</p>
                <div className="mt-5 flex items-center gap-2">
                  <div className="px-3 py-3 bg-slate-100 rounded-xl font-mono text-sm text-slate-600">+91</div>
                  <input
                    data-testid="ef-phone" type="tel" maxLength={10} value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="10-digit mobile"
                    className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-3 font-mono text-lg focus:outline-none focus:border-orange-500"
                  />
                </div>
                <Button
                  data-testid="ef-offers-go" disabled={phone.length !== 10}
                  onClick={() => { trackEvent("offers_redirect", { phone }); window.open(`https://biziverse.com/GQik?i=${phone}`, "_blank"); setEndFlow(null); }}
                  className="w-full mt-5 bg-orange-600 hover:bg-orange-700 text-white rounded-full h-12 font-bold disabled:opacity-50"
                >
                  Continue to Offers
                </Button>
                <button onClick={() => setEndFlow("choose")} className="mt-3 text-xs text-slate-500 hover:text-secondary">← Back</button>
              </>
            )}

            {endFlow === "callback" && (
              <>
                <div className="text-xs uppercase tracking-widest text-orange-600 font-bold">Schedule a call-back</div>
                <h2 className="font-display text-3xl font-black text-secondary mt-2">Enter your details</h2>
                <p className="text-slate-500 text-sm mt-1">Our executive will call you back at the time you choose.</p>
                <div className="mt-5 flex items-center gap-2">
                  <div className="px-3 py-3 bg-slate-100 rounded-xl font-mono text-sm text-slate-600">+91</div>
                  <input
                    data-testid="cb-phone" type="tel" maxLength={10} value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="10-digit mobile"
                    className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-3 font-mono text-lg focus:outline-none focus:border-orange-500"
                  />
                </div>
                <label className="block mt-4 text-xs uppercase tracking-widest text-slate-500 font-bold">Preferred call-back time</label>
                <input
                  data-testid="cb-time" type="datetime-local" value={callbackTime}
                  min={(() => { const d = new Date(Date.now() + 11 * 60 * 1000); d.setSeconds(0); return d.toISOString().slice(0, 16); })()}
                  onChange={e => setCallbackTime(e.target.value)}
                  className="mt-2 w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500"
                />
                <p className="text-xs text-slate-400 mt-1">Minimum 10 minutes from now.</p>
                <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3">Do you want a human agent right away?</div>
                  <label className="flex items-center gap-3 text-sm">
                    <input type="radio" name="human_now" checked={humanNow === true} onChange={() => setHumanNow(true)} className="h-4 w-4 accent-orange-600" />
                    <span>Yes, connect me to a human now</span>
                  </label>
                  <label className="mt-2 flex items-center gap-3 text-sm">
                    <input type="radio" name="human_now" checked={humanNow === false} onChange={() => setHumanNow(false)} className="h-4 w-4 accent-orange-600" />
                    <span>No, wait until the scheduled callback time</span>
                  </label>
                </div>
                {(quiz?.bt || questionsAsked.length > 0) && (
                  <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500 space-y-1">
                    <div className="font-bold text-slate-600 mb-1">We'll share with the executive:</div>
                    {quiz?.bt && <div>• Business type: <span className="font-medium text-slate-700">{quiz.bt}</span></div>}
                    {quiz?.pc && <div>• Product category: <span className="font-medium text-slate-700">{quiz.pc}</span></div>}
                    {videos.length > 0 && <div>• Modules watched: <span className="font-medium text-slate-700">{videos.map(v => v.title).join(", ")}</span></div>}
                    {questionsAsked.length > 0 && <div>• Questions asked: <span className="font-medium text-slate-700">{questionsAsked.slice(0, 3).join("; ")}{questionsAsked.length > 3 ? "…" : ""}</span></div>}
                  </div>
                )}
                <Button
                  data-testid="cb-submit"
                  disabled={phone.length !== 10 || !callbackTime || (new Date(callbackTime).getTime() - Date.now() < 10 * 60 * 1000) || crmLoading}
                  onClick={submitCallback}
                  className="w-full mt-5 bg-secondary hover:bg-secondary/90 text-white rounded-full h-12 font-bold disabled:opacity-50"
                >
                  {crmLoading ? "Scheduling…" : "Request call-back"}
                </Button>
                <button onClick={() => setEndFlow("choose")} className="mt-3 text-xs text-slate-500 hover:text-secondary">← Back</button>
              </>
            )}

            {endFlow === "callback_confirm" && (
              <>
                <div className="h-16 w-16 mx-auto rounded-full bg-emerald-100 grid place-items-center mb-4">
                  <Sparkles className="h-8 w-8 text-emerald-600" />
                </div>
                <h2 className="font-display text-3xl font-black text-secondary text-center">Call-back scheduled!</h2>
                <p className="text-slate-600 text-sm mt-2 text-center">Our executive will call you at:</p>
                <div className="text-center font-display text-xl font-bold text-orange-600 mt-2">
                  {callbackTime ? new Date(callbackTime).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                </div>
                <p className="text-xs text-slate-400 text-center mt-1">on +91 {phone}</p>
                <p className="text-xs text-slate-400 text-center mt-3">
                  {humanNow ? "A human agent will join the chat right away, and they'll already know what you watched and asked." : "They'll already know what you watched and asked — no need to repeat yourself."}
                </p>
                <Button
                  data-testid="cb-done"
                  onClick={() => { setEndFlow(null); setPhone(""); setCallbackTime(""); setHumanNow(false); }}
                  className="w-full mt-6 bg-orange-600 hover:bg-orange-700 text-white rounded-full h-12 font-bold"
                >
                  Done
                </Button>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(s) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function ChatHeader({ lang, agentLive, setChatOpen }) {
  return (
    <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2 justify-between">
      <div className="flex items-center gap-2">
        <div className={`h-9 w-9 rounded-full grid place-items-center ${agentLive ? 'bg-emerald-100' : 'bg-orange-100'}`}>
          {agentLive
            ? <UserCheck className="h-4 w-4 text-emerald-600" />
            : <Sparkles className="h-4 w-4 text-orange-600" />
          }
        </div>
        <div>
          <div className="font-display font-bold text-secondary">{agentLive ? 'Live Support' : 'Biziverse AI'}</div>
          <div className={`text-xs flex items-center gap-1.5 ${agentLive ? 'text-emerald-600' : 'text-slate-500'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${agentLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            {agentLive ? 'Agent is online' : 'AI assistant'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => setChatOpen(false)} className="text-sm px-2 py-1 rounded bg-slate-50 border text-slate-500 hover:bg-slate-100">Close</button>
      </div>
    </div>
  );
}

function ChatBody({ chat, chatLoading, chatEndRef, lang, onAccept, onDecline, onClarifyPick, agentTyping }) {
  const openExec = () => window.dispatchEvent(new CustomEvent("biz-open-callback"));
  return (
    <div className="flex-1 overflow-y-auto thin-scroll px-4 py-4 space-y-2">
      {chat.length === 0 && (
        <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-200">
          Hi! Ask me anything about Biziverse — I'll answer from our knowledge base. Try <em>"Does this support GST?"</em>
        </div>
      )}
      {chat.map((m, i) => {
        // System messages (agent joined notice)
        if (m.role === 'system') {
          return (
            <div key={m._id || i} className="flex justify-center my-2">
              <span className="text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">{m.text}</span>
            </div>
          );
        }
        return (
          <div
            key={m._id || i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`text-sm max-w-[88%] rounded-2xl px-4 py-2.5 ${
              m.role === "user"
                ? "bg-orange-600 text-white rounded-tr-sm"
                : "bg-slate-100 text-slate-800 rounded-tl-sm"
            }`}>
              <div className="leading-relaxed whitespace-pre-wrap break-words">{m.text}</div>
              {m.exec_cta && !m.clarify && (
                <div className="flex gap-2 mt-2">
                  <Button data-testid="exec-cta" size="sm" onClick={openExec} className="bg-secondary hover:bg-secondary/90 text-white rounded-full text-xs h-8">
                    Talk with executive
                  </Button>
                </div>
              )}
              {m.clarify && m.candidates && m.candidates.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-2.5">
                  {m.candidates.map((c, idx) => (
                    <button
                      key={idx}
                      data-testid={`clarify-candidate-${idx}`}
                      onClick={() => onClarifyPick && onClarifyPick(c)}
                      className="text-left text-xs bg-white hover:bg-orange-50 border border-orange-200 hover:border-orange-400 text-secondary px-3 py-2 rounded-xl transition-colors"
                    >
                      {c.question}
                    </button>
                  ))}
                </div>
              )}
              {m.prompt === "show_me" && (
                <div className="flex gap-2 mt-2">
                  <Button data-testid="show-me-yes" size="sm" onClick={() => onAccept(m)} className="bg-orange-600 hover:bg-orange-700 text-white rounded-full text-xs h-8">
                    Show me
                  </Button>
                  <Button data-testid="show-me-no" size="sm" variant="outline" onClick={onDecline} className="rounded-full text-xs h-8">
                    No, thanks
                  </Button>
                </div>
              )}
              {m.created_at && (
                <div className={`text-[10px] mt-1 ${m.role === 'user' ? 'text-white/50 text-right' : 'text-slate-400'}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {chatLoading && (
        <div className="flex justify-start">
          <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5">
            <div className="flex gap-1 items-center h-4">
              {[0, 150, 300].map(d => (
                <span key={d} className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${d}ms`, animationDuration: "0.9s" }} />
              ))}
            </div>
          </div>
        </div>
      )}
      {agentTyping && (
        <div className="flex justify-start">
          <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5">
            <div className="flex gap-1 items-center h-4">
              {[0, 150, 300].map(d => (
                <span key={d} className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: `${d}ms`, animationDuration: "0.9s" }} />
              ))}
            </div>
          </div>
        </div>
      )}
      <div ref={chatEndRef} />
    </div>
  );
}

function ChatInput({ lang, chatInput, setChatInput, send, wsRef }) {
  const typingTimeout = useRef(null);
  const onKey = (e) => {
    if (e.key === "Enter") { send(); return; }
    // send typing start via websocket
    if (wsRef && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try { wsRef.current.send(JSON.stringify({ type: 'typing', payload: { status: 'start' } })); } catch (err) {}
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        try { wsRef.current.send(JSON.stringify({ type: 'typing', payload: { status: 'stop' } })); } catch (err) {}
      }, 1400);
    }
  };
  return (
    <div className="px-5 py-4 border-t border-slate-200">
      <div className="flex gap-2">
        <input
          data-testid="chat-input"
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={onKey}
          placeholder={t(lang, "ask_anything")}
          className="flex-1 border border-slate-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <Button data-testid="chat-send" onClick={send} className="bg-orange-600 hover:bg-orange-700 text-white rounded-full h-10 w-10 p-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}