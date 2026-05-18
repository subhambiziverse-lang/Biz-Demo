import React, { useEffect, useState, useRef } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Plus, Trash2, Upload, Download, Pencil, X, Check, ChevronDown, ChevronUp, Video } from "lucide-react";
import { toast } from "sonner";

const LANGS = ["en", "hi", "gu", "mr"];
const LANG_LABELS = { en: "English", hi: "Hindi", gu: "Gujarati", mr: "Marathi" };

const EMPTY_FORM = {
  question: "",
  answers: { en: "", hi: "", gu: "", mr: "" },
  tags: "",
  active: true,
  video_url: "",
  video_start: "",
  video_end: "",
};

// ── Reusable form fields used by both New Entry and Edit ──
function KBForm({ data, onChange, onSave, onCancel, saveLabel = "Save" }) {
  const [showVideo, setShowVideo] = useState(!!(data.video_url));

  return (
    <div className="grid gap-3">
      {/* Question */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1 block">
          Question *
        </label>
        <input
          placeholder="e.g. Does Biziverse support GST invoicing?"
          value={data.question}
          onChange={e => onChange({ ...data, question: e.target.value })}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {/* Answers per language */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">
          Answers
        </label>
        <div className="grid gap-2">
          {LANGS.map(l => (
            <div key={l} className="flex gap-2 items-start">
              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-600 px-2 py-2 rounded-md w-8 text-center shrink-0">
                {l}
              </span>
              <textarea
                placeholder={`${LANG_LABELS[l]} answer${l === "en" ? " *" : " (optional)"}`}
                value={data.answers?.[l] || ""}
                onChange={e => onChange({ ...data, answers: { ...data.answers, [l]: e.target.value } })}
                rows={2}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1 block">
          Tags <span className="normal-case font-normal">(comma separated)</span>
        </label>
        <input
          placeholder="e.g. gst, invoice, billing"
          value={Array.isArray(data.tags) ? data.tags.join(", ") : data.tags}
          onChange={e => onChange({ ...data, tags: e.target.value })}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {/* Video section — collapsible */}
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowVideo(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            <Video className="h-3.5 w-3.5" />
            Optional: "Show me" Video
            {data.video_url && <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full normal-case font-normal tracking-normal">linked</span>}
          </div>
          {showVideo ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
        {showVideo && (
          <div className="p-4 grid gap-2 bg-white">
            <input
              placeholder="YouTube embed URL (https://www.youtube.com/embed/xxxxx)"
              value={data.video_url || ""}
              onChange={e => onChange({ ...data, video_url: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Start (seconds)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g. 30"
                  value={data.video_start || ""}
                  onChange={e => onChange({ ...data, video_start: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">End (seconds)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g. 90"
                  value={data.video_end || ""}
                  onChange={e => onChange({ ...data, video_end: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button onClick={onSave} className="bg-orange-600 hover:bg-orange-700 text-white">
          <Check className="h-4 w-4 mr-1.5" />
          {saveLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          <X className="h-4 w-4 mr-1.5" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Helper: normalise form data before sending to API ──
function buildPayload(data) {
  const tags = typeof data.tags === "string"
    ? data.tags.split(",").map(s => s.trim()).filter(Boolean)
    : (data.tags || []);
  return {
    question: data.question.trim(),
    answers: data.answers,
    tags,
    active: data.active !== false,
    video_url: data.video_url?.trim() || null,
    video_start: data.video_start !== "" && data.video_start != null ? parseFloat(data.video_start) : null,
    video_end: data.video_end !== "" && data.video_end != null ? parseFloat(data.video_end) : null,
  };
}

export default function KBPage() {
  const [items, setItems]       = useState([]);
  const [showNew, setShowNew]   = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [editId, setEditId]     = useState(null);   // id of item being edited
  const [editData, setEditData] = useState(null);   // copy of item data for editing
  const [filter, setFilter]     = useState("");
  const [uploading, setUploading] = useState(false);
  const csvInputRef = useRef(null);

  const load = () => api.get("/admin/kb").then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  // ── Create new entry ──
  const save = async () => {
    if (!form.question.trim()) { toast.error("Question is required"); return; }
    if (!form.answers.en.trim()) { toast.error("English answer is required"); return; }
    try {
      await api.post("/admin/kb", buildPayload(form));
      toast.success("Entry added");
      setShowNew(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e) { toast.error("Failed to save"); }
  };

  // ── Update existing entry ──
  const update = async () => {
    if (!editData.question.trim()) { toast.error("Question is required"); return; }
    if (!editData.answers?.en?.trim()) { toast.error("English answer is required"); return; }
    try {
      await api.put(`/admin/kb/${editId}`, buildPayload(editData));
      toast.success("Entry updated");
      setEditId(null);
      setEditData(null);
      load();
    } catch (e) { toast.error("Failed to update"); }
  };

  const startEdit = (item) => {
    // Close new-entry form if open
    setShowNew(false);
    setEditId(item.id);
    setEditData({
      ...item,
      tags: Array.isArray(item.tags) ? item.tags.join(", ") : (item.tags || ""),
      video_start: item.video_start ?? "",
      video_end: item.video_end ?? "",
      video_url: item.video_url || "",
    });
  };

  const cancelEdit = () => { setEditId(null); setEditData(null); };

  // ── Delete ──
  const del = async (id) => {
    if (!window.confirm("Delete this KB entry? This cannot be undone.")) return;
    await api.delete(`/admin/kb/${id}`);
    toast.success("Deleted");
    load();
  };

  // ── Toggle active ──
  const toggleActive = async (item) => {
    await api.put(`/admin/kb/${item.id}`, { ...buildPayload(item), active: !item.active });
    load();
  };

  // ── Download template ──
  const downloadTemplate = async () => {
    try {
      const r = await api.get("/admin/kb/template", { responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url; a.download = "kb_template.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error("Could not download template"); }
  };

  // ── Upload CSV ──
  const handleCSVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await api.post(
        "/admin/kb/bulk-upload?on_duplicate=overwrite",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const { inserted, overwritten, skipped, errors } = r.data;
      toast.success(
        `Done! ${inserted} added, ${overwritten} updated, ${skipped} skipped` +
        (errors?.length ? ` — ${errors.length} row error(s)` : "")
      );
      if (errors?.length) {
        errors.forEach(err => toast.error(err, { duration: 6000 }));
      }
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // ── Filter ──
  const filtered = items.filter(i =>
    !filter ||
    i.question.toLowerCase().includes(filter.toLowerCase()) ||
    (i.tags || []).some(t => t.toLowerCase().includes(filter.toLowerCase())) ||
    (i.answers?.en || "").toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-black text-secondary">Knowledge Base</h1>
          <p className="text-sm text-slate-500 mt-0.5">{items.length} entries · {items.filter(i => i.active).length} active</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadTemplate} className="text-sm">
            <Download className="h-4 w-4 mr-1.5" />
            Template
          </Button>
          <Button
            variant="outline"
            onClick={() => csvInputRef.current?.click()}
            disabled={uploading}
            className="text-sm"
          >
            <Upload className="h-4 w-4 mr-1.5" />
            {uploading ? "Uploading…" : "Upload CSV"}
          </Button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCSVUpload}
          />
          <Button
            onClick={() => { setShowNew(true); setEditId(null); setEditData(null); }}
            className="bg-orange-600 hover:bg-orange-700 text-white rounded-full text-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Entry
          </Button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <input
        placeholder="Search by question, answer, or tag…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        className="w-full mb-5 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
      />

      {/* ── New Entry form ── */}
      {showNew && (
        <div className="bg-white border-2 border-orange-200 rounded-2xl p-6 mb-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-secondary text-lg">New KB Entry</h2>
            <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <KBForm
            data={form}
            onChange={setForm}
            onSave={save}
            onCancel={() => { setShowNew(false); setForm(EMPTY_FORM); }}
            saveLabel="Add Entry"
          />
        </div>
      )}

      {/* ── KB list ── */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">
            {filter ? "No entries match your search." : "No KB entries yet. Add one or upload a CSV."}
          </div>
        )}

        {filtered.map(k => (
          <div
            key={k.id}
            className={`bg-white border rounded-2xl transition-all ${
              editId === k.id
                ? "border-orange-300 shadow-md"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            {/* ── Edit mode ── */}
            {editId === k.id ? (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-secondary">Edit Entry</h3>
                  <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <KBForm
                  data={editData}
                  onChange={setEditData}
                  onSave={update}
                  onCancel={cancelEdit}
                  saveLabel="Save Changes"
                />
              </div>
            ) : (
              /* ── View mode ── */
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Question */}
                    <div className="font-display font-bold text-secondary text-base leading-snug">
                      {k.question}
                    </div>

                    {/* English answer preview */}
                    {k.answers?.en && (
                      <div className="text-sm text-slate-600 mt-1.5 line-clamp-2">
                        {k.answers.en}
                      </div>
                    )}

                    {/* Languages that have answers */}
                    <div className="flex gap-1.5 mt-2 flex-wrap items-center">
                      {LANGS.filter(l => k.answers?.[l]).map(l => (
                        <span key={l} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-mono">
                          {l}
                        </span>
                      ))}
                    </div>

                    {/* Video indicator */}
                    {k.video_url && (
                      <div className="text-xs text-orange-600 font-medium mt-2 flex items-center gap-1">
                        <Video className="h-3 w-3" />
                        Video linked
                        {k.video_start != null ? ` · ${k.video_start}s – ${k.video_end ?? "end"}s` : ""}
                      </div>
                    )}

                    {/* Tags */}
                    {(k.tags || []).length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {(k.tags || []).map((t, i) => (
                          <span key={i} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleActive(k)}
                      className={`text-xs ${k.active ? "text-green-700 border-green-200 bg-green-50 hover:bg-green-100" : "text-slate-500"}`}
                    >
                      {k.active ? "Active" : "Inactive"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(k)}
                      className="text-xs"
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => del(k.id)}
                      className="text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Footer count ── */}
      {filtered.length > 0 && (
        <div className="text-center text-xs text-slate-400 mt-6">
          Showing {filtered.length} of {items.length} entries
        </div>
      )}
    </div>
  );
}