import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useApp } from "../contexts/AppContext";
import { t, LANGS } from "../lib/i18n";
import { voice } from "../lib/voice";
import api from "../lib/api";
import { Pause, Play, ExternalLink, Volume2, VolumeX, Send, Sparkles, ArrowLeft, Maximize2, Minimize2, X, MessageCircle, Subtitles } from "lucide-react";
import { loadYouTubeAPI, extractYouTubeId, isYouTube } from "../lib/youtube";

export default function Demo() {
  const nav = useNavigate();
  const { lang, setLang, voiceOn, setVoiceOn, sessionId, demoData, quiz, trackEvent } = useApp();

  const [vidIdx, setVidIdx] = useState(0);
  const [markerIdx, setMarkerIdx] = useState(-1);
  const [activeNarration, setActiveNarration] = useState(null);   // {text, marker}
  const [playing, setPlaying] = useState(true);
  const [tryYourselfMode, setTryYourselfMode] = useState(false);  // iframe biziverse
  const [showTransition, setShowTransition] = useState(false);
  const [askedTry, setAskedTry] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  // End-of-demo flow
  const [endFlow, setEndFlow] = useState(null); // null | "choose" | "offers" | "callback" | "callback_confirm"
  const [phone, setPhone] = useState("");
  const [callbackTime, setCallbackTime] = useState("");

  // Mini-demo state
  const [miniDemoVideo, setMiniDemoVideo] = useState(null);
  const [miniDemoTopic, setMiniDemoTopic] = useState("");  // user's question text
  const userPausedRef = useRef(false);

  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [pendingMini, setPendingMini] = useState(null);  // {mini_id, kb_question}

  const videoRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const ytContainerRef = useRef(null);
  const ytIntervalRef = useRef(null);
  const playerRef = useRef(null);
  const chatEndRef = useRef(null);
  const moduleStripRef = useRef(null);
  const chapterStripRef = useRef(null);

  useEffect(() => { if (!demoData) nav("/quiz"); /* eslint-disable-next-line */ }, []);
  useEffect(() => { trackEvent("demo_started"); /* eslint-disable-next-line */ }, []);
  useEffect(() => { voice.setEnabled(voiceOn); }, [voiceOn]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  // Center the active module chip in the timeline strip
  useEffect(() => {
    const strip = moduleStripRef.current;
    if (!strip) return;
    const active = strip.querySelector(`[data-testid="module-chip-${vidIdx}"]`);
    if (!active) return;
    const target = active.offsetLeft - (strip.clientWidth / 2) + (active.clientWidth / 2);
    strip.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [vidIdx]);

  const videos = demoData?.videos || [];
  const mainVideo = videos[vidIdx];
  const currentVideo = miniDemoVideo || mainVideo;
  const markers = ((currentVideo?.markers) || []).slice().sort((a,b)=>a.timestamp-b.timestamp);
  const inMiniDemo = !!miniDemoVideo;

  // Find the currently active chapter (based on playhead time)
  const chapters = currentVideo?.chapters || [];
  const activeChapterIdx = (() => {
    if (!chapters.length) return -1;
    for (let i = chapters.length - 1; i >= 0; i--) {
      const ch = chapters[i];
      const start = ch.start || 0;
      const end = ch.end != null ? ch.end : Infinity;
      if (progress >= start && progress < end) return i;
    }
    // If past the last chapter's end, still highlight the last
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

  const isYT = isYouTube(currentVideo?.video_url || "");
  const currentMarker = markerIdx >= 0 ? markers[markerIdx] : null;
  // Marker is "active" (showing highlight + cursor) only while between its timestamp and end_time
  const activeMarker = currentMarker && (currentMarker.end_time == null || progress <= currentMarker.end_time + 0.2) ? currentMarker : null;

  // Listen for executive callback request from AI chat
  useEffect(() => {
    const handler = () => setEndFlow("callback");
    window.addEventListener("biz-open-callback", handler);
    return () => window.removeEventListener("biz-open-callback", handler);
  }, []);

  // Compute biziverse_url for try-yourself based on current marker (admin-configurable per-marker)
  const biziverseUrl = (currentMarker && currentMarker.biziverse_url) || currentVideo?.biziverse_url || "https://biziverse.com";

  // Apply voice toggle to video audio (not TTS)
  useEffect(() => {
    if (isYT && ytPlayerRef.current) {
      try {
        if (voiceOn) ytPlayerRef.current.unMute?.(); else ytPlayerRef.current.mute?.();
      } catch(e) {}
    }
    if (!isYT && videoRef.current) {
      videoRef.current.muted = !voiceOn;
    }
    // Also disable TTS entirely to respect "only video audio"
    voice.setEnabled(false);
  }, [voiceOn, isYT, currentVideo?.id]);

  // Player abstraction — works for both HTML5 video and YouTube
  const doPlay = () => { isYT ? ytPlayerRef.current?.playVideo?.() : videoRef.current?.play().catch(()=>{}); };
  const doPause = () => { isYT ? ytPlayerRef.current?.pauseVideo?.() : videoRef.current?.pause(); };
  const doSeek = (t) => { isYT ? ytPlayerRef.current?.seekTo?.(t, true) : (videoRef.current && (videoRef.current.currentTime = t)); };
  const doGetTime = () => { return isYT ? (ytPlayerRef.current?.getCurrentTime?.() || 0) : (videoRef.current?.currentTime || 0); };
  const doGetDuration = () => { return isYT ? (ytPlayerRef.current?.getDuration?.() || 0) : (videoRef.current?.duration || 0); };
  const doIsPaused = () => { return isYT ? (ytPlayerRef.current?.getPlayerState?.() !== 1) : (videoRef.current?.paused ?? true); };

  // Initialize YouTube player when currentVideo changes to YT url
  useEffect(() => {
    if (!currentVideo) return;
    if (!isYT) {
      if (ytPlayerRef.current) { try { ytPlayerRef.current.destroy(); } catch(e){} ytPlayerRef.current = null; }
      return;
    }
    let cancelled = false;
    loadYouTubeAPI().then(YT => {
      if (cancelled || !ytContainerRef.current) return;
      const vid = extractYouTubeId(currentVideo.video_url);
      if (ytPlayerRef.current) { try { ytPlayerRef.current.destroy(); } catch(e){} }
      ytPlayerRef.current = new YT.Player(ytContainerRef.current, {
        videoId: vid,
        playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, playsinline: 1, fs: 0, disablekb: 1, vq: "hd1080", hd: 1, start: currentVideo._kb_start ? Math.floor(currentVideo._kb_start) : 0 },
        events: {
          onReady: (e) => {
            try {
              e.target.setPlaybackQuality?.("hd1080");
              e.target.playVideo();
              if (currentVideo._kb_start) e.target.seekTo(currentVideo._kb_start, true);
            } catch(err){}
            setDuration(e.target.getDuration() || 0);
          },
          onStateChange: (e) => {
            if (e.data === 1) {
              setPlaying(true);
              try { e.target.setPlaybackQuality?.("hd1080"); } catch(err){}
            }
            else if (e.data === 2) setPlaying(false);
            else if (e.data === 0) {
              if (inMiniDemo) exitMiniDemo();
              else if (vidIdx + 1 < videos.length) {
                setShowTransition(true);
                setTimeout(() => { setShowTransition(false); setVidIdx(i=>i+1); setMarkerIdx(-1); }, 1600);
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
    // eslint-disable-next-line
  }, [currentVideo?.id, isYT]);

  // Unified time + marker poller (works for both players)
  useEffect(() => {
    if (!currentVideo || tryYourselfMode) return;
    if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
    ytIntervalRef.current = setInterval(() => {
      const t = doGetTime();
      const d = doGetDuration();
      setProgress(t);
      if (d && Math.abs(d - duration) > 0.5) setDuration(d);
      // Auto-end KB-played clips at _kb_end
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

  // Legacy MP4-only listeners (kept for non-YT)
  useEffect(() => {
    if (isYT) return;
    const v = videoRef.current; if (!v) return;
    const onEnd = () => {
      if (inMiniDemo) exitMiniDemo();
      else if (vidIdx + 1 < videos.length) {
        setShowTransition(true);
        setTimeout(() => { setShowTransition(false); setVidIdx(i=>i+1); setMarkerIdx(-1); }, 1600);
      } else { trackEvent("demo_ended"); setEndFlow("choose"); voice.stop(); }
    };
    v.addEventListener("ended", onEnd);
    return () => v.removeEventListener("ended", onEnd);
    // eslint-disable-next-line
  }, [vidIdx, videos.length, inMiniDemo, isYT]);

  useEffect(() => {
    if (isYT) return;
    if (videoRef.current && playing && !tryYourselfMode) videoRef.current.play().catch(()=>{});
  }, [vidIdx, playing, tryYourselfMode, currentVideo, isYT]);

  // Remove the separate seekBy since we now use skipToMarker
  const triggerMarker_unused = () => {};

  const triggerMarker = (m) => {
    doPause();
    const text = m.narration?.[lang] || m.narration?.en || "";
    setActiveNarration({ text, marker: m });
    // Show caption for the configured pause_duration, then auto-resume (no TTS — user wants only video audio)
    const wait = Math.max((m.pause_duration || 3) * 1000, 1000);
    setTimeout(() => {
      setActiveNarration(null);
      if (userPausedRef.current) return;
      if (!tryYourselfMode) {
        doPlay();
        setPlaying(true);
        if (!askedTry && markerIdx >= 1 && !inMiniDemo) {
          setAskedTry(true);
          const askText = t(lang, "want_try");
          setChat(c => [...c, { role: "ai", text: askText, prompt: "want_try" }]);
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

  // Skip forward / backward 10 seconds
  const skipSeconds = (delta) => {
    voice.stop();
    setActiveNarration(null);
    const newT = Math.max(0, Math.min(doGetTime() + delta, doGetDuration() || 99999));
    doSeek(newT);
    // Recompute markerIdx based on new time
    let newIdx = -1;
    for (let i = 0; i < markers.length; i++) if (markers[i].timestamp <= newT) newIdx = i;
    setMarkerIdx(newIdx);
    if (!userPausedRef.current) doPlay();
  };

  // Jump to specific module (video) in the sequence
  const jumpToModule = (idx) => {
    if (idx < 0 || idx >= videos.length || idx === vidIdx) return;
    voice.stop();
    setActiveNarration(null);
    setVidIdx(idx);
    setMarkerIdx(-1);
  };

  const tryYourself = () => {
    // Cleanup YT player before switching to iframe mode to avoid removeChild errors
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.pauseVideo?.(); } catch(e){}
    }
    voice.stop();
    setTryYourselfMode(true);
    trackEvent("interactive_mode_entered");
  };
  const exitTryYourself = () => {
    setTryYourselfMode(false);
    setPlaying(true);
    setTimeout(()=> doPlay(), 200);
    trackEvent("demo_resumed");
  };

  const playKBVideo = (videoUrl, topic = "", start = 0, end = null) => {
    if (!videoUrl) return;
    voice.stop();
    doPause();
    // Construct a synthetic mini video object so the YT/HTML5 player handles it
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

  const playMiniDemo = (videoUrl, topic = "") => playKBVideo(videoUrl, topic);

  const exitMiniDemo = () => {
    voice.stop();
    setMiniDemoVideo(null);
    setMiniDemoTopic("");
    setMarkerIdx(-1);
    setActiveNarration(null);
    userPausedRef.current = false;
    setPlaying(true);
    // Force YT player to re-initialize for main video by toggling refresh tick
    trackEvent("mini_demo_exited");
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const q = chatInput.trim();
    setChat(c => [...c, { role: "user", text: q }]);
    setChatInput(""); setChatLoading(true);
    if (!tryYourselfMode) doPause();
    voice.stop();
    try {
      const r = await api.post("/ai/chat", {
        session_id: sessionId, message: q, language: lang,
        business_type: quiz?.bt, product_category: quiz?.pc,
        modules: quiz?.mods || [], current_step: vidIdx
      });
      const ans = r.data.answer || "";
      const videoUrl = r.data.video_url;
      const noAnswer = r.data.no_answer;
      const clarify = r.data.clarify;
      const candidates = r.data.candidates || [];
      const msg = { role: "ai", text: ans };
      if (noAnswer) msg.exec_cta = true;
      if (clarify && candidates.length) {
        msg.clarify = true;
        msg.candidates = candidates;
      }
      setChat(c => [...c, msg]);
      if (videoUrl) {
        setPendingMini({ video_url: videoUrl, topic: q, start: r.data.video_start, end: r.data.video_end });
        setChat(c => [...c, { role: "ai", text: "Want me to show you how this works?", prompt: "show_me", video_url: videoUrl, topic: q, video_start: r.data.video_start, video_end: r.data.video_end }]);
      } else if (!noAnswer && !clarify) {
        if (!tryYourselfMode && playing) doPlay();
      }
    } catch (e) {
      setChat(c => [...c, { role: "ai", text: "I'm having trouble answering right now. Please try again." }]);
    }
    setChatLoading(false);
  };

  const pickClarifyCandidate = (cand) => {
    setChatInput(cand.question);
    setTimeout(() => {
      setChatInput("");
      setChat(c => [...c, { role: "user", text: cand.question }]);
      setChatLoading(true);
      (async () => {
        try {
          const r = await api.post("/ai/chat", {
            session_id: sessionId, message: cand.question, language: lang,
            business_type: quiz?.bt, product_category: quiz?.pc,
            modules: quiz?.mods || [], current_step: vidIdx
          });
          const ans = r.data.answer || "";
          const videoUrl = r.data.video_url;
          const noAnswer = r.data.no_answer;
          const msg = { role: "ai", text: ans };
          if (noAnswer) msg.exec_cta = true;
          setChat(c => [...c, msg]);
          if (videoUrl) {
            setPendingMini({ video_url: videoUrl, topic: cand.question, start: r.data.video_start, end: r.data.video_end });
            setChat(c => [...c, { role: "ai", text: "Want me to show you how this works?", prompt: "show_me", video_url: videoUrl, topic: cand.question, video_start: r.data.video_start, video_end: r.data.video_end }]);
          }
        } catch (e) {
          setChat(c => [...c, { role: "ai", text: "I'm having trouble answering right now. Please try again." }]);
        }
        setChatLoading(false);
      })();
    }, 10);
  };

  const acceptShowMe = (m) => playKBVideo(m.video_url, m.topic, m.video_start, m.video_end);
  const declineShowMe = () => {
    setPendingMini(null);
    setChat(c => c.filter(m => m.prompt !== "show_me"));
    if (!tryYourselfMode) { doPlay(); setPlaying(true); }
  };

  const transitionLabel = videos[vidIdx + 1]?.title || "";

  // Layout: when maximized, full-screen video + floating chat. Otherwise split layout.
  return (
    <div className={maximized ? "fixed inset-0 bg-black z-50" : "min-h-screen bg-slate-100"}>
      {/* Top bar */}
      {!maximized && (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button data-testid="demo-back" variant="ghost" size="sm" onClick={()=>{ voice.stop(); nav("/quiz"); }} className="text-slate-600">
                <ArrowLeft className="h-4 w-4 mr-1" /> {t(lang, "back")}
              </Button>
              <img src="https://biziverse.com/WebExt/img/logo2.jpg" alt="Biziverse" className="h-7 w-auto" />
              <span className="text-xs uppercase tracking-widest text-orange-600 font-bold border-l pl-3">Live Demo</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="hidden md:flex items-center text-xs text-slate-500 mr-2">{currentVideo?.title}{inMiniDemo && " · Showing answer"}</div>
              <select data-testid="demo-lang-select" value={lang} onChange={e=>setLang(e.target.value)} className="text-sm border border-slate-200 rounded-full px-3 py-1.5 bg-white">
                {LANGS.map(l=><option key={l.code} value={l.code}>{l.native}</option>)}
              </select>
              <Button data-testid="voice-toggle" variant="outline" size="sm" onClick={()=>setVoiceOn(v=>!v)}>
                {voiceOn ? <Volume2 className="h-4 w-4 mr-1.5" /> : <VolumeX className="h-4 w-4 mr-1.5" />} {voiceOn ? "Sound On" : "Muted"}
              </Button>
              <Button data-testid="end-demo" variant="ghost" size="sm" onClick={()=>{ voice.stop(); setEndFlow("choose"); }}>End demo</Button>
            </div>
          </div>
        </header>
      )}

      <main className={maximized ? "h-screen w-screen relative" : "max-w-[1600px] mx-auto px-4 lg:px-8 py-6 grid lg:grid-cols-12 gap-6"}>
        {/* Video / Iframe column */}
        <div className={maximized ? "h-full w-full" : "lg:col-span-8"}>
          <div ref={playerRef} className={`relative bg-black overflow-hidden ${maximized ? "w-full h-full" : "rounded-2xl shadow-2xl border border-slate-200 aspect-video"}`}>
            {/* YT player ALWAYS mounted (hidden during try-yourself) to avoid React removeChild on YT-managed iframe */}
            {isYT && !tryYourselfMode && (
              <div className="absolute inset-0 pointer-events-none" data-testid="yt-wrap">
                <div ref={ytContainerRef} className="w-full h-full" />
              </div>
            )}
            {isYT && tryYourselfMode && (
              <div style={{display:"none"}}><div ref={ytContainerRef} /></div>
            )}

            {tryYourselfMode ? (
              <div className="absolute inset-0 overflow-hidden bg-white z-10">
                <iframe data-testid="biziverse-iframe" src={biziverseUrl} title="Biziverse"
                  style={{
                    width: "142%", height: "142%",
                    transform: "scale(0.7)", transformOrigin: "top left", border: 0
                  }}
                  className="bg-white" />
              </div>
            ) : !isYT && currentVideo && (
              <video ref={videoRef} data-testid="demo-video"
                src={currentVideo.video_url}
                className="w-full h-full object-cover" playsInline autoPlay preload="auto" />
            )}

            {/* Highlight overlay */}
            {activeMarker?.highlight && !tryYourselfMode && (
              <div className="demo-highlight" style={{
                left: `${activeMarker.highlight.x}%`, top: `${activeMarker.highlight.y}%`,
                width: `${activeMarker.highlight.w}%`, height: `${activeMarker.highlight.h}%`,
                borderRadius: activeMarker.highlight.shape === "circle" ? "50%" : "12px"
              }} />
            )}
            {/* Cursor */}
            {activeMarker?.cursor && !tryYourselfMode && (
              <div className="demo-cursor" style={{ left: `${activeMarker.cursor.x}%`, top: `${activeMarker.cursor.y}%` }} />
            )}

            {/* Inline narration caption (over video) */}
            {activeNarration && captionsOn && !tryYourselfMode && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-20 max-w-2xl px-5 py-3 bg-slate-950/85 backdrop-blur-md text-white rounded-2xl shadow-2xl z-30 border border-white/10">
                <div className="flex items-start gap-2">
                  <div className="h-6 w-6 rounded-full bg-orange-600 grid place-items-center flex-shrink-0 mt-0.5"><Sparkles className="h-3 w-3" /></div>
                  <div className="text-sm leading-relaxed">{activeNarration.text}</div>
                </div>
              </div>
            )}

            {/* Module chip top-center */}
            {!tryYourselfMode && currentVideo && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
                <div className="px-4 py-1.5 bg-slate-950/70 backdrop-blur-md text-white rounded-full text-xs font-bold tracking-wider uppercase border border-white/10 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                  {inMiniDemo ? `${miniDemoTopic || currentVideo.title}` : currentVideo.title}
                </div>
              </div>
            )}

            {/* Mini-demo "Return to demo" — prominent pill with label */}
            {inMiniDemo && !tryYourselfMode && (
              <button data-testid="exit-mini-demo" onClick={exitMiniDemo}
                className="absolute top-4 left-4 z-30 h-10 px-4 rounded-full bg-white/95 hover:bg-white text-slate-950 grid place-items-center shadow-lg border border-white/30 transition-colors">
                <span className="flex items-center gap-2 text-sm font-bold"><ArrowLeft className="h-4 w-4" /> Return to Demo</span>
              </button>
            )}

            {/* Try Yourself "Return to Demo" — icon-only, transparent */}
            {tryYourselfMode && (
              <button data-testid="exit-try-yourself" onClick={exitTryYourself}
                title="Return to demo"
                className="absolute top-4 left-4 z-30 h-10 w-10 rounded-full bg-orange-600/80 hover:bg-orange-600 backdrop-blur-md text-white grid place-items-center border border-white/20 shadow-lg transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}

            {/* Maximize / Minimize */}
            <button onClick={()=>setMaximized(m=>!m)} data-testid="toggle-maximize"
              className="absolute top-4 right-4 z-30 h-10 w-10 rounded-full bg-slate-950/70 hover:bg-slate-950 text-white grid place-items-center shadow-lg">
              {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            {/* Transition between videos */}
            {showTransition && (
              <div className="absolute inset-0 bg-secondary/95 grid place-items-center z-40">
                <div className="text-center fade-up">
                  <div className="text-xs uppercase tracking-widest text-amber-300 font-bold">{t(lang, "now_showing")}</div>
                  <div className="font-display text-3xl sm:text-5xl font-black text-white mt-2">{transitionLabel}</div>
                </div>
              </div>
            )}

            {/* Custom video controls bar (bottom) */}
            {!tryYourselfMode && currentVideo && (
              <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-slate-950/85 to-transparent z-30 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-xs text-white/80 font-mono w-12 text-right">{fmtTime(progress)}</div>
                  <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer hover:h-2 transition-all"
                    onClick={(e)=>{ const r=e.currentTarget.getBoundingClientRect(); const p=(e.clientX-r.left)/r.width; doSeek(p * (duration||0)); }}>
                    <div className="h-full bg-orange-500" style={{ width: `${duration ? (progress/duration)*100 : 0}%` }} />
                  </div>
                  <div className="text-xs text-white/80 font-mono w-12">{fmtTime(duration)}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button data-testid="seek-back" onClick={()=>skipSeconds(-10)} title="Back 10 seconds"
                    className="h-10 w-10 rounded-full text-white hover:bg-white/10 grid place-items-center relative">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 2v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 8"/>
                    </svg>
                    <span className="absolute text-[9px] font-black mt-0.5">10</span>
                  </button>
                  <button data-testid="player-play-pause" onClick={togglePlay} title="Play/Pause"
                    className="h-10 w-10 rounded-full bg-white text-slate-950 hover:bg-orange-500 hover:text-white grid place-items-center transition-colors">
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                  </button>
                  <button data-testid="seek-fwd" onClick={()=>skipSeconds(10)} title="Forward 10 seconds"
                    className="h-10 w-10 rounded-full text-white hover:bg-white/10 grid place-items-center relative">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 2v6h-6"/><path d="M21 13a9 9 0 1 1-3-7.7L21 8"/>
                    </svg>
                    <span className="absolute text-[9px] font-black mt-0.5">10</span>
                  </button>
                  <div className="flex-1" />
                  <button data-testid="captions-toggle" onClick={()=>setCaptionsOn(c=>!c)} title="Captions"
                    className={`h-9 px-3 rounded-full text-xs font-bold grid place-items-center transition-colors ${captionsOn ? "bg-white text-slate-950" : "text-white hover:bg-white/10 border border-white/20"}`}>
                    <div className="flex items-center gap-1.5"><Subtitles className="h-3.5 w-3.5" /> CC</div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Module timeline / chapter navigator — below player */}
          {!maximized && !tryYourselfMode && !inMiniDemo && videos.length > 1 && (
            <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-3">
              <div ref={moduleStripRef} className="flex items-center gap-2 overflow-x-auto thin-scroll scroll-smooth">
                {videos.map((v, i) => (
                  <button key={v.id} data-testid={`module-chip-${i}`} onClick={()=>jumpToModule(i)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${i===vidIdx ? "bg-orange-600 text-white ring-2 ring-orange-300" : i<vidIdx ? "bg-slate-100 text-slate-500 line-through" : "bg-slate-100 text-slate-700 hover:bg-orange-50"}`}>
                    <span className="opacity-60 mr-1">{i+1}.</span>{v.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Video chapters strip (YouTube-style timestamps configured by admin) */}
          {!maximized && !tryYourselfMode && (currentVideo?.chapters || []).length > 0 && (
            <div className="mt-3 bg-white border border-slate-200 rounded-2xl p-3">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">Chapters</div>
              <div ref={chapterStripRef} className="flex items-center gap-2 overflow-x-auto thin-scroll scroll-smooth">
                {(currentVideo.chapters || []).map((ch, i) => {
                  const isActive = i === activeChapterIdx;
                  return (
                    <button key={i} data-testid={`chapter-chip-${i}`} onClick={()=>doSeek(ch.start || 0)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs border text-center transition-colors ${isActive ? "bg-orange-600 text-white border-orange-700 shadow-sm ring-2 ring-orange-300" : "bg-slate-50 hover:bg-orange-50 border-slate-200 text-slate-700 hover:border-orange-300"}`}>
                      <div className={`font-bold ${isActive ? "text-white" : "text-secondary"}`}>{ch.name}</div>
                      <div className={`text-[10px] font-mono ${isActive ? "text-white/80" : "text-slate-400"}`}>{fmtTime(ch.start||0)}{ch.end ? ` – ${fmtTime(ch.end)}` : ""}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Player controls (Try Yourself) — hide when maximized */}
          {!maximized && !tryYourselfMode && !inMiniDemo && (currentVideo?.show_try_yourself !== false) && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button data-testid="try-yourself" onClick={tryYourself} className="bg-secondary hover:bg-secondary/90 text-white rounded-full">
                <ExternalLink className="h-4 w-4 mr-2" /> {t(lang,"try_yourself")}
              </Button>
              <div className="flex-1" />
              <div className="text-sm text-slate-500">Step {vidIdx+1} of {videos.length}</div>
            </div>
          )}
        </div>

        {/* AI Assistant — sidebar OR floating bubble */}
        {!maximized ? (
          <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl flex flex-col h-[calc(100vh-180px)] sticky top-[72px]">
            <ChatHeader lang={lang} />
            <ChatBody chat={chat} chatLoading={chatLoading} chatEndRef={chatEndRef} lang={lang}
              onAccept={acceptShowMe} onDecline={declineShowMe} onClarifyPick={pickClarifyCandidate} />
            <ChatInput lang={lang} chatInput={chatInput} setChatInput={setChatInput} send={sendChat} />
          </aside>
        ) : (
          // Floating chat bubble in maximized mode
          chatOpen ? (
            <div className="fixed bottom-6 right-6 w-96 h-[520px] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col z-50">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-orange-100 grid place-items-center"><Sparkles className="h-4 w-4 text-orange-600" /></div>
                  <div className="font-display font-bold text-secondary">Biziverse AI</div>
                </div>
                <button onClick={()=>setChatOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
              </div>
              <ChatBody chat={chat} chatLoading={chatLoading} chatEndRef={chatEndRef} lang={lang}
                onAccept={acceptShowMe} onDecline={declineShowMe} onClarifyPick={pickClarifyCandidate} />
              <ChatInput lang={lang} chatInput={chatInput} setChatInput={setChatInput} send={sendChat} />
            </div>
          ) : (
            <button data-testid="open-chat-bubble" onClick={()=>setChatOpen(true)}
              className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-orange-600 hover:bg-orange-700 text-white shadow-2xl shadow-orange-500/40 grid place-items-center z-50">
              <MessageCircle className="h-6 w-6" />
            </button>
          )
        )}
      </main>

      {/* End-of-demo modal */}
      {endFlow && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[60] grid place-items-center p-6" data-testid="end-flow-modal">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
            {endFlow === "choose" && (
              <>
                <div className="text-xs uppercase tracking-widest text-orange-600 font-bold">Demo complete</div>
                <h2 className="font-display text-3xl font-black text-secondary mt-2">What would you like next?</h2>
                <p className="text-slate-500 text-sm mt-2">Pick an option to continue.</p>
                <div className="grid gap-2 mt-6">
                  <button data-testid="ef-explore" onClick={()=>{ setEndFlow(null); setVidIdx(0); setMarkerIdx(-1); setTimeout(()=>doPlay(),300); }}
                    className="text-left p-4 rounded-xl border-2 border-slate-200 hover:border-orange-300 bg-white transition-colors">
                    <div className="font-display font-bold text-secondary">Explore the demo again</div>
                    <div className="text-xs text-slate-500">Restart from the first module</div>
                  </button>
                  <button data-testid="ef-offers" onClick={()=>{ setEndFlow("offers"); trackEvent("offers_selected"); }}
                    className="text-left p-4 rounded-xl border-2 border-orange-500 bg-orange-50 transition-colors">
                    <div className="font-display font-bold text-orange-700">Proceed to offers & get full access</div>
                    <div className="text-xs text-slate-600">Grab your plan and start using Biziverse</div>
                  </button>
                  <button data-testid="ef-callback" onClick={()=>{ setEndFlow("callback"); trackEvent("callback_selected"); }}
                    className="text-left p-4 rounded-xl border-2 border-slate-200 hover:border-slate-300 bg-white transition-colors">
                    <div className="font-display font-bold text-secondary">Talk with an executive</div>
                    <div className="text-xs text-slate-500">Schedule a call-back from our team</div>
                  </button>
                </div>
                <button onClick={()=>setEndFlow(null)} className="mt-4 text-xs text-slate-400 hover:text-slate-600">Close</button>
              </>
            )}

            {endFlow === "offers" && (
              <>
                <div className="text-xs uppercase tracking-widest text-orange-600 font-bold">Get started</div>
                <h2 className="font-display text-3xl font-black text-secondary mt-2">Enter your mobile number</h2>
                <p className="text-slate-500 text-sm mt-1">We'll take you to the offers page to complete your signup.</p>
                <div className="mt-5 flex items-center gap-2">
                  <div className="px-3 py-3 bg-slate-100 rounded-xl font-mono text-sm text-slate-600">+91</div>
                  <input data-testid="ef-phone" type="tel" maxLength={10} value={phone}
                    onChange={e=>setPhone(e.target.value.replace(/\D/g,""))}
                    placeholder="10-digit mobile"
                    className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-3 font-mono text-lg focus:outline-none focus:border-orange-500" />
                </div>
                <Button data-testid="ef-offers-go" disabled={phone.length!==10}
                  onClick={()=>{ trackEvent("offers_redirect", { phone }); window.open(`https://biziverse.com/GQik?i=${phone}`, "_blank"); setEndFlow(null); }}
                  className="w-full mt-5 bg-orange-600 hover:bg-orange-700 text-white rounded-full h-12 font-bold disabled:opacity-50">
                  Continue to Offers
                </Button>
                <button onClick={()=>setEndFlow("choose")} className="mt-3 text-xs text-slate-500 hover:text-secondary">← Back</button>
              </>
            )}

            {endFlow === "callback" && (
              <>
                <div className="text-xs uppercase tracking-widest text-orange-600 font-bold">Schedule a call-back</div>
                <h2 className="font-display text-3xl font-black text-secondary mt-2">Enter your details</h2>
                <p className="text-slate-500 text-sm mt-1">Our executive will call you back at the time you choose.</p>
                <div className="mt-5 flex items-center gap-2">
                  <div className="px-3 py-3 bg-slate-100 rounded-xl font-mono text-sm text-slate-600">+91</div>
                  <input data-testid="cb-phone" type="tel" maxLength={10} value={phone}
                    onChange={e=>setPhone(e.target.value.replace(/\D/g,""))}
                    placeholder="10-digit mobile"
                    className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-3 font-mono text-lg focus:outline-none focus:border-orange-500" />
                </div>
                <label className="block mt-4 text-xs uppercase tracking-widest text-slate-500 font-bold">Preferred call-back time</label>
                <input data-testid="cb-time" type="datetime-local" value={callbackTime}
                  min={(()=>{ const d=new Date(Date.now()+11*60*1000); d.setSeconds(0); return d.toISOString().slice(0,16); })()}
                  onChange={e=>setCallbackTime(e.target.value)}
                  className="mt-2 w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500" />
                <p className="text-xs text-slate-400 mt-1">Minimum 10 minutes from now.</p>
                <Button data-testid="cb-submit"
                  disabled={phone.length!==10 || !callbackTime || (new Date(callbackTime).getTime() - Date.now() < 10*60*1000)}
                  onClick={()=>{ trackEvent("callback_requested", { phone, callbackTime }); setEndFlow("callback_confirm"); }}
                  className="w-full mt-5 bg-secondary hover:bg-secondary/90 text-white rounded-full h-12 font-bold disabled:opacity-50">
                  Request call-back
                </Button>
                <button onClick={()=>setEndFlow("choose")} className="mt-3 text-xs text-slate-500 hover:text-secondary">← Back</button>
              </>
            )}

            {endFlow === "callback_confirm" && (
              <>
                <div className="h-16 w-16 mx-auto rounded-full bg-emerald-100 grid place-items-center mb-4"><Sparkles className="h-8 w-8 text-emerald-600" /></div>
                <h2 className="font-display text-3xl font-black text-secondary text-center">Call-back scheduled</h2>
                <p className="text-slate-600 text-sm mt-2 text-center">We'll try calling you back at:</p>
                <div className="text-center font-display text-xl font-bold text-orange-600 mt-2">
                  {callbackTime ? new Date(callbackTime).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                </div>
                <p className="text-xs text-slate-400 text-center mt-3">on +91 {phone}</p>
                <Button data-testid="cb-done" onClick={()=>{ setEndFlow(null); setPhone(""); setCallbackTime(""); }}
                  className="w-full mt-6 bg-orange-600 hover:bg-orange-700 text-white rounded-full h-12 font-bold">Done</Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function fmtTime(s) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s/60), sec = Math.floor(s%60);
  return `${m}:${sec.toString().padStart(2,"0")}`;
}

function ChatHeader({ lang }) {
  return (
    <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
      <div className="h-9 w-9 rounded-full bg-orange-100 grid place-items-center"><Sparkles className="h-4 w-4 text-orange-600" /></div>
      <div>
        <div className="font-display font-bold text-secondary">Biziverse AI</div>
        <div className="text-xs text-emerald-600 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live</div>
      </div>
    </div>
  );
}

function ChatBody({ chat, chatLoading, chatEndRef, lang, onAccept, onDecline, onClarifyPick, settings }) {
  const openExec = () => {
    const ev = new CustomEvent("biz-open-callback");
    window.dispatchEvent(ev);
  };
  return (
    <div className="flex-1 overflow-y-auto thin-scroll px-5 py-4 space-y-3">
      {chat.length === 0 && (
        <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-200">
          Hi! Ask me anything about Biziverse — I'll answer from our knowledge base. Try <em>"Does this support GST?"</em>
        </div>
      )}
      {chat.map((m,i)=>(
        <div key={i} className={`text-sm ${m.role==="user"?"ml-auto bg-orange-600 text-white":"bg-slate-100 text-slate-800"} max-w-[90%] rounded-2xl px-4 py-2.5`}>
          <div>{m.text}</div>
          {m.exec_cta && (
            <div className="flex gap-2 mt-2">
              <Button data-testid="exec-cta" size="sm" onClick={openExec} className="bg-secondary hover:bg-secondary/90 text-white rounded-full text-xs h-8">Talk with executive</Button>
            </div>
          )}
          {m.clarify && m.candidates && m.candidates.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-2.5">
              {m.candidates.map((c, idx) => (
                <button key={idx}
                  data-testid={`clarify-candidate-${idx}`}
                  onClick={() => onClarifyPick && onClarifyPick(c)}
                  className="text-left text-xs bg-white hover:bg-orange-50 border border-orange-200 hover:border-orange-400 text-secondary px-3 py-2 rounded-xl transition-colors">
                  {c.question}
                </button>
              ))}
            </div>
          )}
          {m.prompt === "show_me" && (
            <div className="flex gap-2 mt-2">
              <Button data-testid="show-me-yes" size="sm" onClick={()=>onAccept(m)} className="bg-orange-600 hover:bg-orange-700 text-white rounded-full text-xs h-8">Show me</Button>
              <Button data-testid="show-me-no" size="sm" variant="outline" onClick={onDecline} className="rounded-full text-xs h-8">No, thanks</Button>
            </div>
          )}
        </div>
      ))}
      {chatLoading && <div className="text-xs text-slate-500">AI is thinking…</div>}
      <div ref={chatEndRef} />
    </div>
  );
}

function ChatInput({ lang, chatInput, setChatInput, send }) {
  return (
    <div className="px-5 py-4 border-t border-slate-200">
      <div className="flex gap-2">
        <input data-testid="chat-input" value={chatInput} onChange={e=>setChatInput(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter") send();}}
          placeholder={t(lang,"ask_anything")}
          className="flex-1 border border-slate-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
        <Button data-testid="chat-send" onClick={send} className="bg-orange-600 hover:bg-orange-700 text-white rounded-full h-10 w-10 p-0"><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
