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

  useEffect(() => { if (!demoData) nav("/quiz"); /* eslint-disable-next-line */ }, []);
  useEffect(() => { trackEvent("demo_started"); /* eslint-disable-next-line */ }, []);
  useEffect(() => { voice.setEnabled(voiceOn); }, [voiceOn]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  const videos = demoData?.videos || [];
  const mainVideo = videos[vidIdx];
  const currentVideo = miniDemoVideo || mainVideo;
  const markers = ((currentVideo?.markers) || []).slice().sort((a,b)=>a.timestamp-b.timestamp);
  const inMiniDemo = !!miniDemoVideo;

  const isYT = isYouTube(currentVideo?.video_url || "");

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
        playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, playsinline: 1, fs: 0, disablekb: 1 },
        events: {
          onReady: (e) => { try { e.target.playVideo(); } catch(err){} setDuration(e.target.getDuration() || 0); },
          onStateChange: (e) => {
            if (e.data === 1) { setPlaying(true); }       // playing
            else if (e.data === 2) setPlaying(false);    // paused
            else if (e.data === 0) {                      // ended
              if (inMiniDemo) exitMiniDemo();
              else if (vidIdx + 1 < videos.length) {
                setShowTransition(true);
                setTimeout(() => { setShowTransition(false); setVidIdx(i=>i+1); setMarkerIdx(-1); }, 1600);
              } else {
                trackEvent("conversion_viewed");
                nav("/conversion");
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
      } else { trackEvent("conversion_viewed"); nav("/conversion"); }
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
    voice.speak(text, lang, () => {
      const wait = (m.pause_duration || 0) * 1000;
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
            voice.speak(askText, lang);
          }
        }
      }, Math.max(wait, 200));
    });
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
    setTryYourselfMode(true); voice.stop(); videoRef.current?.pause();
    trackEvent("interactive_mode_entered");
  };
  const exitTryYourself = () => {
    setTryYourselfMode(false);
    setPlaying(true);
    setTimeout(()=> videoRef.current?.play().catch(()=>{}), 200);
    trackEvent("demo_resumed");
  };

  const playMiniDemo = async (miniId, topic = "") => {
    try {
      const r = await api.get(`/mini-demos/${miniId}`);
      const v = r.data?.video;
      if (!v) return;
      voice.stop();
      videoRef.current?.pause();
      setMiniDemoVideo(v);
      setMiniDemoTopic(topic);
      setMarkerIdx(-1);
      setActiveNarration(null);
      userPausedRef.current = false;
      setTimeout(()=> { videoRef.current && (videoRef.current.currentTime = 0); videoRef.current?.play().catch(()=>{}); }, 200);
      trackEvent("mini_demo_started", { mini_id: miniId, topic });
      setPendingMini(null);
    } catch (e) { console.error(e); }
  };

  const exitMiniDemo = () => {
    voice.stop();
    setMiniDemoVideo(null);
    setMiniDemoTopic("");
    setMarkerIdx(-1);
    setActiveNarration(null);
    userPausedRef.current = false;
    setTimeout(()=> { videoRef.current?.play().catch(()=>{}); setPlaying(true); }, 300);
    trackEvent("mini_demo_exited");
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const q = chatInput.trim();
    setChat(c => [...c, { role: "user", text: q }]);
    setChatInput(""); setChatLoading(true);
    if (!tryYourselfMode) videoRef.current?.pause(); voice.stop();
    try {
      const r = await api.post("/ai/chat", {
        session_id: sessionId, message: q, language: lang,
        business_type: quiz?.bt, product_category: quiz?.pc,
        modules: quiz?.mods || [], current_step: vidIdx
      });
      const ans = r.data.answer || "";
      const linkedMini = r.data.linked_mini_demo_id;
      setChat(c => [...c, { role: "ai", text: ans }]);
      if (linkedMini) {
        setPendingMini({ mini_id: linkedMini, topic: q });
        setChat(c => [...c, { role: "ai", text: "Want me to show you how this works?", prompt: "show_me", mini_id: linkedMini, topic: q }]);
      }
      voice.speak(ans, lang, () => {
        if (!tryYourselfMode && playing && !linkedMini) videoRef.current?.play().catch(()=>{});
      });
    } catch (e) {
      setChat(c => [...c, { role: "ai", text: "I'm having trouble answering right now. Please try again." }]);
    }
    setChatLoading(false);
  };

  const acceptShowMe = (miniId, topic) => playMiniDemo(miniId, topic);
  const declineShowMe = () => {
    setPendingMini(null);
    if (!tryYourselfMode && playing) videoRef.current?.play().catch(()=>{});
  };

  const currentMarker = markerIdx >= 0 ? markers[markerIdx] : null;
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
              <div className="hidden md:flex items-center text-xs text-slate-500 mr-2">{currentVideo?.title}{inMiniDemo && " · Mini-demo"}</div>
              <select data-testid="demo-lang-select" value={lang} onChange={e=>setLang(e.target.value)} className="text-sm border border-slate-200 rounded-full px-3 py-1.5 bg-white">
                {LANGS.map(l=><option key={l.code} value={l.code}>{l.native}</option>)}
              </select>
              <Button data-testid="voice-toggle" variant="outline" size="sm" onClick={()=>setVoiceOn(v=>!v)}>
                {voiceOn ? <Volume2 className="h-4 w-4 mr-1.5" /> : <VolumeX className="h-4 w-4 mr-1.5" />} {t(lang, voiceOn?"voice_on":"voice_off")}
              </Button>
              <Button data-testid="end-demo" variant="ghost" size="sm" onClick={()=>nav("/conversion")}>Skip to summary</Button>
            </div>
          </div>
        </header>
      )}

      <main className={maximized ? "h-screen w-screen relative" : "max-w-[1600px] mx-auto px-4 lg:px-8 py-6 grid lg:grid-cols-12 gap-6"}>
        {/* Video / Iframe column */}
        <div className={maximized ? "h-full w-full" : "lg:col-span-8"}>
          <div ref={playerRef} className={`relative bg-black overflow-hidden ${maximized ? "w-full h-full" : "rounded-2xl shadow-2xl border border-slate-200 aspect-video"}`}>
            {tryYourselfMode ? (
              <div className="absolute inset-0 overflow-hidden bg-white">
                <iframe data-testid="biziverse-iframe" src="https://biziverse.com" title="Biziverse"
                  style={{
                    width: "142%", height: "142%",
                    transform: "scale(0.7)", transformOrigin: "top left", border: 0
                  }}
                  className="bg-white" />
              </div>
            ) : isYT ? (
              <div className="absolute inset-0 pointer-events-none" data-testid="yt-wrap">
                <div ref={ytContainerRef} className="w-full h-full" />
              </div>
            ) : (
              currentVideo && (
                <video ref={videoRef} data-testid="demo-video"
                  src={currentVideo.video_url}
                  className="w-full h-full object-cover" playsInline autoPlay muted preload="auto" />
              )
            )}

            {/* Highlight overlay */}
            {currentMarker?.highlight && !tryYourselfMode && (
              <div className="demo-highlight" style={{
                left: `${currentMarker.highlight.x}%`, top: `${currentMarker.highlight.y}%`,
                width: `${currentMarker.highlight.w}%`, height: `${currentMarker.highlight.h}%`,
                borderRadius: currentMarker.highlight.shape === "circle" ? "50%" : "12px"
              }} />
            )}
            {/* Cursor */}
            {currentMarker?.cursor && !tryYourselfMode && (
              <div className="demo-cursor" style={{ left: `${currentMarker.cursor.x}%`, top: `${currentMarker.cursor.y}%` }} />
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
                  {inMiniDemo ? `Mini-demo · ${miniDemoTopic || currentVideo.title}` : currentVideo.title}
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
                  <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer"
                    onClick={(e)=>{ const r=e.currentTarget.getBoundingClientRect(); const p=(e.clientX-r.left)/r.width; if (videoRef.current) videoRef.current.currentTime = p * (duration||0); }}>
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
              <div className="flex items-center gap-2 overflow-x-auto thin-scroll">
                {videos.map((v, i) => (
                  <button key={v.id} data-testid={`module-chip-${i}`} onClick={()=>jumpToModule(i)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${i===vidIdx ? "bg-orange-600 text-white" : i<vidIdx ? "bg-slate-100 text-slate-500 line-through" : "bg-slate-100 text-slate-700 hover:bg-orange-50"}`}>
                    <span className="opacity-60 mr-1">{i+1}.</span>{v.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Player controls (Try Yourself) — hide when maximized */}
          {!maximized && !tryYourselfMode && !inMiniDemo && (
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
              onAccept={acceptShowMe} onDecline={declineShowMe} />
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
                onAccept={acceptShowMe} onDecline={declineShowMe} />
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

function ChatBody({ chat, chatLoading, chatEndRef, lang, onAccept, onDecline }) {
  return (
    <div className="flex-1 overflow-y-auto thin-scroll px-5 py-4 space-y-3">
      {chat.length === 0 && (
        <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-200">
          Hi! I'll narrate this demo and answer any questions you have. Try asking <em>"Does this support GST?"</em> or <em>"How does Recovery work?"</em>
        </div>
      )}
      {chat.map((m,i)=>(
        <div key={i} className={`text-sm ${m.role==="user"?"ml-auto bg-orange-600 text-white":"bg-slate-100 text-slate-800"} max-w-[90%] rounded-2xl px-4 py-2.5`}>
          <div>{m.text}</div>
          {m.prompt === "show_me" && m.mini_id && (
            <div className="flex gap-2 mt-2">
              <Button data-testid="show-me-yes" size="sm" onClick={()=>onAccept(m.mini_id, m.topic)} className="bg-orange-600 hover:bg-orange-700 text-white rounded-full text-xs h-8">Show me</Button>
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
