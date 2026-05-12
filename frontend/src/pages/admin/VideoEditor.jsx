import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Plus, Trash2, Save, ArrowLeft, Youtube, ExternalLink, Upload } from "lucide-react";
import { toast } from "sonner";
import { isYouTube, extractYouTubeId, loadYouTubeAPI } from "../../lib/youtube";

const LANGS = ["en","hi","gu","mr"];

export default function VideoEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [video, setVideo] = useState(null);
  const [activeMarker, setActiveMarker] = useState(null);
  const [showChapters, setShowChapters] = useState(false);
  const videoRef = useRef(null);
  const ytContainerRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const overlayRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => { api.get("/admin/videos2").then(r => setVideo(r.data.find(v=>v.id===id))); }, [id]);

  const isYT = isYouTube(video?.video_url || "");

  // YouTube player for admin preview
  useEffect(() => {
    if (!video || !isYT) { if (ytPlayerRef.current) { try { ytPlayerRef.current.destroy(); } catch(e){} ytPlayerRef.current = null; } return; }
    let cancelled = false;
    loadYouTubeAPI().then(YT => {
      if (cancelled || !ytContainerRef.current) return;
      if (ytPlayerRef.current) { try { ytPlayerRef.current.destroy(); } catch(e){} }
      ytPlayerRef.current = new YT.Player(ytContainerRef.current, {
        videoId: extractYouTubeId(video.video_url),
        playerVars: { controls: 1, modestbranding: 1, rel: 0, playsinline: 1 },
        events: { onReady: () => {} }
      });
    });
    const iv = setInterval(() => {
      const t = isYT ? (ytPlayerRef.current?.getCurrentTime?.() || 0) : (videoRef.current?.currentTime || 0);
      setCurrentTime(t);
    }, 400);
    return () => { cancelled = true; clearInterval(iv); };
  }, [video?.video_url, isYT]);

  const getTime = () => isYT ? (ytPlayerRef.current?.getCurrentTime?.() || 0) : (videoRef.current?.currentTime || 0);
  const seekTo = (t) => { if (isYT) ytPlayerRef.current?.seekTo?.(t, true); else if (videoRef.current) videoRef.current.currentTime = t; };

  const updateMarker = (mid, patch) => setVideo(v => ({ ...v, markers: v.markers.map(m=> m.id===mid ? {...m, ...patch} : m) }));
  const addMarker = () => {
    const t = getTime();
    const m = {
      id: crypto.randomUUID(),
      timestamp: +t.toFixed(1),
      end_time: +(t+5).toFixed(1),
      pause_duration: 4,
      highlight: { x: 20, y: 30, w: 40, h: 15, shape: "rect" },
      cursor: { x: 35, y: 38 },
      narration: { en: "", hi: "", gu: "", mr: "" },
      biziverse_url: ""
    };
    setVideo(v => ({ ...v, markers: [...(v.markers||[]), m] }));
    setActiveMarker(m.id);
  };
  const delMarker = (mid) => setVideo(v => ({ ...v, markers: v.markers.filter(m=>m.id!==mid) }));

  const save = async () => {
    try { await api.put(`/admin/videos/${id}`, video); toast.success("Saved"); }
    catch(e) { toast.error(e.response?.data?.detail || "Save failed"); }
  };

  const publish = async () => {
    const ok = (video.markers||[]).every(m => LANGS.every(l => (m.narration?.[l]||"").length > 0));
    if (!ok) return toast.error("Every marker must have narration in all 4 languages to publish");
    try {
      const payload = { ...video, published: true };
      await api.put(`/admin/videos/${id}`, payload);
      setVideo(payload);
      toast.success("Published");
    } catch(e) { toast.error(e.response?.data?.detail || "Publish failed"); }
  };

  const convertYoutubeURL = () => {
    const ytId = extractYouTubeId(video.video_url);
    if (ytId) {
      setVideo({ ...video, video_url: `https://www.youtube.com/embed/${ytId}` });
      toast.success("Converted to embed URL");
    }
  };

  const onOverlayClick = (e) => {
    if (!activeMarker || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((e.clientX-rect.left)/rect.width)*100;
    const y = ((e.clientY-rect.top)/rect.height)*100;
    updateMarker(activeMarker, { cursor: { x: +x.toFixed(1), y: +y.toFixed(1) } });
  };

  const handleUpload = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const fd = new FormData(); fd.append("file", f);
    toast.info("Uploading…");
    try {
      const r = await api.post("/admin/upload", fd);
      setVideo({...video, video_url: `${api.defaults.baseURL}/files/${r.data.storage_path}`, storage_path: r.data.storage_path});
      toast.success("Uploaded");
    } catch (err) { toast.error("Upload failed"); }
  };

  if (!video) return <div className="p-8">Loading…</div>;
  const am = video.markers?.find(m=>m.id===activeMarker);

  return (
    <div className="p-8">
      <Button variant="ghost" onClick={()=>nav("/admin/videos")} className="mb-4"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex-1 min-w-0">
          <input data-testid="vid-title" value={video.title} onChange={e=>setVideo({...video, title: e.target.value})} className="font-display text-2xl font-black text-secondary border-b border-transparent focus:border-orange-500 outline-none bg-transparent w-full" />
          <div className="flex items-center gap-2 mt-2">
            <input data-testid="vid-url" value={video.video_url} onChange={e=>setVideo({...video, video_url: e.target.value})} placeholder="YouTube URL or MP4 URL" className="flex-1 text-xs text-slate-500 outline-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono" />
            {video.video_url?.includes("youtu") && !video.video_url?.includes("/embed/") && (
              <Button size="sm" variant="outline" onClick={convertYoutubeURL}><Youtube className="h-3.5 w-3.5 mr-1 text-red-500" />Convert to Embed</Button>
            )}
            <label className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-slate-50 inline-flex items-center"><Upload className="h-3.5 w-3.5 mr-1" />Upload MP4<input type="file" accept="video/*" onChange={handleUpload} className="hidden" /></label>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <label className="text-xs text-slate-500 flex items-center gap-2 flex-1">
              Default Biziverse URL for "Try Yourself":
              <input value={video.biziverse_url || ""} onChange={e=>setVideo({...video, biziverse_url: e.target.value})} placeholder="https://biziverse.com/..." className="flex-1 outline-none bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-xs" />
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs whitespace-nowrap">
              <input type="checkbox" checked={video.show_try_yourself !== false}
                onChange={e=>setVideo({...video, show_try_yourself: e.target.checked})} className="accent-orange-600 h-4 w-4" />
              Show "Try Yourself" on this video
            </label>
          </div>
          {/* Targeting */}
          <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
            <label>
              <div className="uppercase tracking-widest text-slate-500 font-bold mb-1">Languages (empty=all)</div>
              <input value={(video.target_languages||[]).join(",")} onChange={e=>setVideo({...video, target_languages: e.target.value.split(",").map(s=>s.trim()).filter(Boolean)})} placeholder="en,hi,gu,mr" className="w-full border border-slate-200 rounded px-2 py-1 font-mono" />
            </label>
            <label>
              <div className="uppercase tracking-widest text-slate-500 font-bold mb-1">Business types (empty=all)</div>
              <input value={(video.target_business_types||[]).join(",")} onChange={e=>setVideo({...video, target_business_types: e.target.value.split(",").map(s=>s.trim()).filter(Boolean)})} placeholder="wholesale,distributor,..." className="w-full border border-slate-200 rounded px-2 py-1 font-mono" />
            </label>
            <label>
              <div className="uppercase tracking-widest text-slate-500 font-bold mb-1">Product categories (empty=all)</div>
              <input value={(video.target_product_categories||[]).join(",")} onChange={e=>setVideo({...video, target_product_categories: e.target.value.split(",").map(s=>s.trim()).filter(Boolean)})} placeholder="textiles,electronics,..." className="w-full border border-slate-200 rounded px-2 py-1 font-mono" />
            </label>
          </div>
        </div>
        <div className="flex gap-2">
          <Button data-testid="save-vid" onClick={save} variant="outline"><Save className="h-4 w-4 mr-2" />Save</Button>
          <Button data-testid="publish-vid" onClick={publish} className={video.published ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-orange-600 hover:bg-orange-700 text-white"}>{video.published ? "Published" : "Publish"}</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-video">
            {isYT ? (
              <div className="absolute inset-0">
                <div ref={ytContainerRef} className="w-full h-full" />
              </div>
            ) : (
              <video ref={videoRef} src={video.video_url} controls className="w-full h-full" />
            )}
            <div ref={overlayRef} onClick={onOverlayClick} className="absolute inset-0" style={{cursor: activeMarker ? "crosshair" : "default", pointerEvents: activeMarker ? "auto" : "none"}}>
              {am?.highlight && <div className="demo-highlight" style={{ left:`${am.highlight.x}%`, top:`${am.highlight.y}%`, width:`${am.highlight.w}%`, height:`${am.highlight.h}%`, borderRadius: am.highlight.shape==="circle"?"50%":"12px"}} />}
              {am?.cursor && <div className="demo-cursor" style={{ left:`${am.cursor.x}%`, top:`${am.cursor.y}%` }} />}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <div>Current time: <span className="font-mono font-bold text-secondary">{currentTime.toFixed(1)}s</span></div>
            <div>{activeMarker ? "Click inside the video to place the cursor position" : "Select a marker to edit its overlays"}</div>
          </div>

          {/* Chapters editor (YouTube-style timestamps) */}
          <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-display font-bold text-secondary">Chapters / Timestamps</div>
              <Button size="sm" onClick={()=>{
                const t = getTime();
                const name = prompt("Chapter name (e.g. 'Import Leads'):"); if (!name) return;
                setVideo({...video, chapters: [...(video.chapters||[]), { name, start: +t.toFixed(1), end: null }]});
              }} className="bg-orange-600 text-white"><Plus className="h-3.5 w-3.5 mr-1" />Add @ {currentTime.toFixed(1)}s</Button>
            </div>
            <div className="space-y-1.5">
              {(video.chapters||[]).sort((a,b)=>(a.start||0)-(b.start||0)).map((ch, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                  <button onClick={()=>seekTo(ch.start||0)} className="font-mono text-xs text-orange-600 font-bold w-16 text-left hover:underline">{Math.floor((ch.start||0)/60)}:{(Math.floor(ch.start||0)%60).toString().padStart(2,"0")}</button>
                  <input value={ch.name} onChange={e=>{ const c=[...video.chapters]; c[i]={...c[i], name:e.target.value}; setVideo({...video, chapters:c}); }}
                    className="flex-1 bg-transparent outline-none text-sm font-semibold" />
                  <input type="number" step="0.1" value={ch.start} onChange={e=>{ const c=[...video.chapters]; c[i]={...c[i], start:+e.target.value}; setVideo({...video, chapters:c}); }}
                    className="w-20 text-xs font-mono border border-slate-200 rounded px-1 py-0.5" />
                  <input type="number" step="0.1" placeholder="end" value={ch.end||""} onChange={e=>{ const c=[...video.chapters]; c[i]={...c[i], end:e.target.value?+e.target.value:null}; setVideo({...video, chapters:c}); }}
                    className="w-20 text-xs font-mono border border-slate-200 rounded px-1 py-0.5" />
                  <button onClick={()=>setVideo({...video, chapters: video.chapters.filter((_,j)=>j!==i)})} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {(video.chapters||[]).length === 0 && <div className="text-xs text-slate-400 text-center py-4">No chapters yet. Add timestamps so users can jump to specific sections.</div>}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="font-display font-bold text-secondary">Markers ({video.markers?.length||0})</div>
            <Button data-testid="add-marker" size="sm" onClick={addMarker} className="bg-orange-600 text-white"><Plus className="h-3.5 w-3.5 mr-1" />Add at {currentTime.toFixed(1)}s</Button>
          </div>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto thin-scroll pr-1">
            {(video.markers||[]).sort((a,b)=>a.timestamp-b.timestamp).map(m=>(
              <div key={m.id} onClick={()=>{ setActiveMarker(m.id); seekTo(m.timestamp); }}
                className={`bg-white border rounded-xl p-3 cursor-pointer transition-all ${activeMarker===m.id?"border-orange-500 ring-2 ring-orange-200 shadow-md":"border-slate-200"}`}>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono text-slate-500">@ {m.timestamp.toFixed(1)}s → {(m.end_time||m.timestamp+m.pause_duration).toFixed(1)}s</div>
                  <Button size="sm" variant="ghost" onClick={(e)=>{e.stopPropagation(); delMarker(m.id);}}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                </div>
                {activeMarker===m.id && (
                  <div className="mt-3 space-y-3 text-sm" onClick={e=>e.stopPropagation()}>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="text-xs">Start (s)<input type="number" step="0.1" value={m.timestamp} onChange={e=>updateMarker(m.id,{timestamp:+e.target.value})} className="border border-slate-200 rounded px-2 py-1 w-full font-mono text-xs" /></label>
                      <label className="text-xs">End (s)<input type="number" step="0.1" value={m.end_time||m.timestamp+m.pause_duration} onChange={e=>updateMarker(m.id,{end_time:+e.target.value})} className="border border-slate-200 rounded px-2 py-1 w-full font-mono text-xs" /></label>
                      <label className="text-xs">Pause (s)<input type="number" step="0.5" value={m.pause_duration} onChange={e=>updateMarker(m.id,{pause_duration:+e.target.value})} className="border border-slate-200 rounded px-2 py-1 w-full font-mono text-xs" /></label>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 font-bold mb-1">Highlight area (% of video)</div>
                      <div className="grid grid-cols-4 gap-1">
                        {["x","y","w","h"].map(k=><label key={k} className="text-[10px] uppercase text-slate-400"><div>{k}</div><input type="number" value={m.highlight?.[k]??0} onChange={e=>updateMarker(m.id,{highlight:{...m.highlight,[k]:+e.target.value}})} className="border border-slate-200 rounded px-1 py-1 text-xs w-full font-mono" /></label>)}
                      </div>
                    </div>
                    <label className="text-xs block">
                      <div className="text-slate-500 font-bold mb-1 flex items-center gap-1"><ExternalLink className="h-3 w-3" />"Try Yourself" URL (opens inside player at this marker)</div>
                      <input value={m.biziverse_url||""} onChange={e=>updateMarker(m.id,{biziverse_url:e.target.value})} placeholder="Leave empty to use default" className="border border-slate-200 rounded px-2 py-1 w-full font-mono text-xs" />
                    </label>
                    <div>
                      <div className="text-xs text-slate-500 font-bold mb-1">Narration text (per language)</div>
                      {LANGS.map(l=>(
                        <textarea key={l} placeholder={`${l.toUpperCase()}: on-screen caption text`} value={m.narration?.[l]||""}
                          onChange={e=>updateMarker(m.id,{narration:{...(m.narration||{}), [l]: e.target.value}})}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-xs mb-1" rows={2} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {(video.markers||[]).length === 0 && <div className="text-xs text-slate-400 text-center p-6 border-2 border-dashed border-slate-200 rounded-xl">No markers yet. Play the video, pause at a moment, click "Add at [time]".</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
