import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const LANGS = ["en","hi","gu","mr"];

export default function VideoEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [video, setVideo] = useState(null);
  const [activeMarker, setActiveMarker] = useState(null);
  const videoRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => { api.get("/admin/videos2").then(r => setVideo(r.data.find(v=>v.id===id))); }, [id]);

  const updateMarker = (mid, patch) => setVideo(v => ({ ...v, markers: v.markers.map(m=> m.id===mid ? {...m, ...patch} : m) }));
  const addMarker = () => {
    const t = videoRef.current?.currentTime || 0;
    const m = { id: crypto.randomUUID(), timestamp: +t.toFixed(1), pause_duration: 4, highlight: { x: 20, y: 30, w: 40, h: 15, shape: "rect" }, cursor: { x: 35, y: 38 }, narration: { en: "" } };
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
    setVideo(v=>({...v, published: true}));
    try { await api.put(`/admin/videos/${id}`, { ...video, published: true }); toast.success("Published"); }
    catch(e) { toast.error("Publish failed"); }
  };

  const onOverlayClick = (e) => {
    if (!activeMarker || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((e.clientX-rect.left)/rect.width)*100;
    const y = ((e.clientY-rect.top)/rect.height)*100;
    updateMarker(activeMarker, { cursor: { x: +x.toFixed(1), y: +y.toFixed(1) } });
  };

  if (!video) return <div className="p-8">Loading…</div>;
  const am = video.markers?.find(m=>m.id===activeMarker);

  return (
    <div className="p-8">
      <Button variant="ghost" onClick={()=>nav("/admin/videos")} className="mb-4"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
      <div className="flex items-center justify-between mb-4">
        <div>
          <input data-testid="vid-title" value={video.title} onChange={e=>setVideo({...video, title: e.target.value})} className="font-display text-2xl font-black text-secondary border-b border-transparent focus:border-orange-500 outline-none bg-transparent" />
          <input data-testid="vid-url" value={video.video_url} onChange={e=>setVideo({...video, video_url: e.target.value})} placeholder="Video URL" className="block text-xs text-slate-500 w-96 mt-1 outline-none" />
        </div>
        <div className="flex gap-2">
          <Button data-testid="save-vid" onClick={save} variant="outline"><Save className="h-4 w-4 mr-2" />Save</Button>
          <Button data-testid="publish-vid" onClick={publish} className="bg-orange-600 hover:bg-orange-700 text-white">Publish</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-video">
            <video ref={videoRef} src={video.video_url} controls className="w-full h-full" />
            <div ref={overlayRef} onClick={onOverlayClick} className="absolute inset-0" style={{cursor: activeMarker ? "crosshair" : "default"}}>
              {am?.highlight && <div className="demo-highlight" style={{ left:`${am.highlight.x}%`, top:`${am.highlight.y}%`, width:`${am.highlight.w}%`, height:`${am.highlight.h}%`, borderRadius: am.highlight.shape==="circle"?"50%":"12px"}} />}
              {am?.cursor && <div className="demo-cursor" style={{ left:`${am.cursor.x}%`, top:`${am.cursor.y}%` }} />}
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">{activeMarker ? "Click on video to set cursor X/Y" : "Select a marker to edit overlays"}</div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="font-display font-bold text-secondary">Markers ({video.markers?.length||0})</div>
            <Button data-testid="add-marker" size="sm" onClick={addMarker} className="bg-orange-600 text-white"><Plus className="h-3.5 w-3.5 mr-1" />Add at current time</Button>
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto thin-scroll">
            {(video.markers||[]).sort((a,b)=>a.timestamp-b.timestamp).map(m=>(
              <div key={m.id} onClick={()=>{setActiveMarker(m.id); videoRef.current && (videoRef.current.currentTime = m.timestamp);}}
                className={`bg-white border rounded-xl p-3 cursor-pointer ${activeMarker===m.id?"border-orange-500 ring-2 ring-orange-200":"border-slate-200"}`}>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-500">@ {m.timestamp.toFixed(1)}s · pause {m.pause_duration}s</div>
                  <Button size="sm" variant="ghost" onClick={(e)=>{e.stopPropagation(); delMarker(m.id);}}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                </div>
                {activeMarker===m.id && (
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs">Time<input type="number" step="0.1" value={m.timestamp} onChange={e=>updateMarker(m.id,{timestamp:+e.target.value})} className="border border-slate-200 rounded px-2 py-1 w-full" /></label>
                      <label className="text-xs">Pause (s)<input type="number" step="0.5" value={m.pause_duration} onChange={e=>updateMarker(m.id,{pause_duration:+e.target.value})} className="border border-slate-200 rounded px-2 py-1 w-full" /></label>
                    </div>
                    <div className="text-xs text-slate-500">Highlight</div>
                    <div className="grid grid-cols-4 gap-1">
                      {["x","y","w","h"].map(k=><input key={k} type="number" value={m.highlight?.[k]??0} onChange={e=>updateMarker(m.id,{highlight:{...m.highlight,[k]:+e.target.value}})} className="border border-slate-200 rounded px-1 py-1 text-xs" placeholder={k} />)}
                    </div>
                    <div className="text-xs text-slate-500 mt-2">Narration per language</div>
                    {LANGS.map(l=>(
                      <textarea key={l} placeholder={`${l}: narration text`} value={m.narration?.[l]||""}
                        onChange={e=>updateMarker(m.id,{narration:{...(m.narration||{}), [l]: e.target.value}})}
                        className="w-full border border-slate-200 rounded px-2 py-1 text-xs" rows={2} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
