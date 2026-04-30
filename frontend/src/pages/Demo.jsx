import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useApp } from "../contexts/AppContext";
import { t, LANGS } from "../lib/i18n";
import { voice } from "../lib/voice";
import api from "../lib/api";
import { Pause, Play, ExternalLink, RotateCw, Volume2, VolumeX, Send, Sparkles } from "lucide-react";

export default function Demo() {
  const nav = useNavigate();
  const { lang, setLang, voiceOn, setVoiceOn, sessionId, demoData, quiz, trackEvent } = useApp();
  const [vidIdx, setVidIdx] = useState(0);
  const [markerIdx, setMarkerIdx] = useState(-1);
  const [playing, setPlaying] = useState(true);
  const [interactive, setInteractive] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [askedTry, setAskedTry] = useState(false);
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => { if (!demoData) nav("/quiz"); /* eslint-disable-next-line */ }, []);
  useEffect(() => { trackEvent("demo_started"); /* eslint-disable-next-line */ }, []);
  useEffect(() => { voice.setEnabled(voiceOn); }, [voiceOn]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  const videos = demoData?.videos || [];
  const currentVideo = videos[vidIdx];
  const markers = (currentVideo?.markers || []).slice().sort((a,b)=>a.timestamp-b.timestamp);

  // Marker watcher
  useEffect(() => {
    if (!currentVideo || interactive) return;
    const v = videoRef.current;
    if (!v) return;
    const handler = () => {
      if (markerIdx + 1 < markers.length && v.currentTime >= markers[markerIdx + 1].timestamp) {
        const nextIdx = markerIdx + 1;
        setMarkerIdx(nextIdx);
        triggerMarker(markers[nextIdx]);
      }
    };
    v.addEventListener("timeupdate", handler);
    return () => v.removeEventListener("timeupdate", handler);
  }, [markerIdx, markers, interactive, currentVideo]);

  // Video end -> next or conversion
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onEnd = () => {
      if (vidIdx + 1 < videos.length) {
        setShowTransition(true);
        setTimeout(() => {
          setShowTransition(false); setVidIdx(i => i+1); setMarkerIdx(-1);
        }, 1600);
      } else {
        trackEvent("conversion_viewed");
        nav("/conversion");
      }
    };
    v.addEventListener("ended", onEnd);
    return () => v.removeEventListener("ended", onEnd);
    // eslint-disable-next-line
  }, [vidIdx, videos.length]);

  // Auto-play attempt on video change
  useEffect(() => {
    if (videoRef.current && playing && !interactive) {
      videoRef.current.play().catch(()=>{});
    }
  }, [vidIdx, playing, interactive]);

  const triggerMarker = (m) => {
    const v = videoRef.current; if (!v) return;
    v.pause();
    const text = m.narration?.[lang] || m.narration?.en || "";
    setChat(c => [...c, { role: "ai", text, scripted: true }]);
    voice.speak(text, lang, () => {
      // After narration, optional pause duration then resume
      const wait = (m.pause_duration || 0) * 1000;
      setTimeout(() => {
        if (!interactive && playing && videoRef.current) {
          videoRef.current.play().catch(()=>{});
          // After 1-2 markers, ask "Want to try yourself?"
          if (!askedTry && markerIdx >= 1) {
            setAskedTry(true);
            const askText = t(lang, "want_try");
            setChat(c => [...c, { role: "ai", text: askText, ask: true }]);
            voice.speak(askText, lang);
          }
        }
      }, Math.max(wait, 200));
    });
  };

  const togglePlay = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); voice.setEnabled(voiceOn); }
    else { v.pause(); setPlaying(false); voice.stop(); }
  };

  const tryYourself = () => {
    setInteractive(true); voice.stop(); videoRef.current?.pause();
    trackEvent("interactive_mode_entered");
    window.open("https://app.biziverse.com", "_blank");
  };
  const resumeDemo = () => {
    setInteractive(false); setPlaying(true); videoRef.current?.play();
    trackEvent("demo_resumed");
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const q = chatInput.trim();
    setChat(c => [...c, { role: "user", text: q }]);
    setChatInput(""); setChatLoading(true);
    if (!interactive) videoRef.current?.pause(); voice.stop();
    try {
      const r = await api.post("/ai/chat", {
        session_id: sessionId, message: q, language: lang,
        business_type: quiz?.bt, product_category: quiz?.pc,
        modules: quiz?.mods || [], current_step: vidIdx
      });
      const ans = r.data.answer || "";
      setChat(c => [...c, { role: "ai", text: ans }]);
      voice.speak(ans, lang, () => {
        if (!interactive && playing) videoRef.current?.play().catch(()=>{});
      });
    } catch (e) {
      setChat(c => [...c, { role: "ai", text: "I'm having trouble answering right now. Please try again." }]);
    }
    setChatLoading(false);
  };

  const currentMarker = markerIdx >= 0 ? markers[markerIdx] : null;
  const transitionLabel = videos[vidIdx + 1]?.title || "";

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="font-display font-black text-lg text-secondary"><img src="https://biziverse.com/WebExt/img/logo2.jpg" alt="Biziverse" className="h-7 w-auto" /></div>
            <span className="text-xs uppercase tracking-widest text-orange-600 font-bold border-l pl-3">Live Demo</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="hidden md:flex items-center text-xs text-slate-500 mr-2">{currentVideo?.title}</div>
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

      <main className="max-w-[1600px] mx-auto px-4 lg:px-8 py-6 grid lg:grid-cols-12 gap-6">
        {/* Video column */}
        <div className="lg:col-span-8">
          <div ref={playerRef} className="relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-200 aspect-video">
            {currentVideo && (
              <video ref={videoRef} data-testid="demo-video"
                src={currentVideo.video_url}
                className="w-full h-full object-cover" playsInline autoPlay muted={false}
                preload="auto" />
            )}

            {/* Highlight overlay */}
            {currentMarker?.highlight && !interactive && (
              <div className="demo-highlight" style={{
                left: `${currentMarker.highlight.x}%`, top: `${currentMarker.highlight.y}%`,
                width: `${currentMarker.highlight.w}%`, height: `${currentMarker.highlight.h}%`,
                borderRadius: currentMarker.highlight.shape === "circle" ? "50%" : "12px"
              }} />
            )}

            {/* Cursor */}
            {currentMarker?.cursor && !interactive && (
              <div className="demo-cursor" style={{ left: `${currentMarker.cursor.x}%`, top: `${currentMarker.cursor.y}%` }} />
            )}

            {/* Transition between videos */}
            {showTransition && (
              <div className="absolute inset-0 bg-secondary/95 grid place-items-center z-40">
                <div className="text-center fade-up">
                  <div className="text-xs uppercase tracking-widest text-amber-300 font-bold">{t(lang, "now_showing")}</div>
                  <div className="font-display text-3xl sm:text-5xl font-black text-white mt-2">{transitionLabel}</div>
                </div>
              </div>
            )}

            {/* Interactive overlay */}
            {interactive && (
              <div className="absolute inset-0 bg-secondary/85 grid place-items-center z-40 p-8 text-center">
                <div className="max-w-md">
                  <div className="text-xs uppercase tracking-widest text-amber-300 font-bold">Interactive Mode</div>
                  <h3 className="font-display text-3xl font-black text-white mt-2">Now try it yourself</h3>
                  <p className="text-white/80 mt-3">Biziverse has opened in a new tab. Explore the real product at your own pace. The AI assistant is still here to help.</p>
                  <Button data-testid="resume-demo" onClick={resumeDemo} className="mt-6 bg-orange-600 hover:bg-orange-700 text-white rounded-full px-8 h-12 font-bold">
                    <RotateCw className="mr-2 h-4 w-4" /> {t(lang,"resume_demo")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Player controls */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button data-testid="play-pause" onClick={togglePlay} variant="outline" className="rounded-full">
              {playing ? <><Pause className="h-4 w-4 mr-2" /> {t(lang,"pause")}</> : <><Play className="h-4 w-4 mr-2" /> {t(lang,"play")}</>}
            </Button>
            <Button data-testid="try-yourself" onClick={tryYourself} className="bg-secondary hover:bg-secondary/90 text-white rounded-full">
              <ExternalLink className="h-4 w-4 mr-2" /> {t(lang,"try_yourself")}
            </Button>
            <div className="flex-1" />
            <div className="text-sm text-slate-500">Step {vidIdx+1} of {videos.length}</div>
          </div>
        </div>

        {/* AI Assistant panel */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl flex flex-col h-[calc(100vh-180px)] sticky top-[72px]">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-orange-100 grid place-items-center"><Sparkles className="h-4 w-4 text-orange-600" /></div>
            <div>
              <div className="font-display font-bold text-secondary">Biziverse AI</div>
              <div className="text-xs text-emerald-600 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto thin-scroll px-5 py-4 space-y-3">
            {chat.length === 0 && (
              <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-200">
                Hi! I'll narrate this demo and answer any questions you have. Try asking <em>"Does this support GST?"</em> or <em>"How does Recovery work?"</em>
              </div>
            )}
            {chat.map((m,i)=>(
              <div key={i} className={`text-sm ${m.role==="user"?"ml-auto bg-orange-600 text-white":"bg-slate-100 text-slate-800"} max-w-[85%] rounded-2xl px-4 py-2.5`}>
                {m.text}
              </div>
            ))}
            {chatLoading && <div className="text-xs text-slate-500">AI is thinking…</div>}
            <div ref={chatEndRef} />
          </div>
          <div className="px-5 py-4 border-t border-slate-200">
            <div className="flex gap-2">
              <input data-testid="chat-input" value={chatInput} onChange={e=>setChatInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter") sendChat();}}
                placeholder={t(lang,"ask_anything")}
                className="flex-1 border border-slate-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <Button data-testid="chat-send" onClick={sendChat} className="bg-orange-600 hover:bg-orange-700 text-white rounded-full h-10 w-10 p-0"><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
