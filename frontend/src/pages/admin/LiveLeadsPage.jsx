import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";

export default function LiveLeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/live-leads");
      setLeads(res.data);
    } catch (err) {
      toast.error("Unable to load live leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const nav = useNavigate();
  const assignSelf = async (id) => {
    try {
      const res = await api.post(`/admin/live-leads/${id}/assign`);
      toast.success("Assigned live lead to you");
      // Open the live lead detail/chat for this lead
      const leadId = res.data?.lead?.id || id;
      nav(`/admin/live-leads/${leadId}`);
    } catch (err) {
      toast.error("Failed to assign live lead");
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/admin/live-leads/${id}`, { status });
      toast.success("Live lead status updated");
      load();
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-black text-secondary">Live Leads</h1>
          <p className="text-slate-500 text-sm">Monitor immediate human chat requests and assign leads for follow-up.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</Button>
      </div>

      {leads.length === 0 ? (
        <div className="text-sm text-slate-500 rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
          No live leads yet. New requests will appear here as users ask for a human now or wait for their scheduled callback.
        </div>
      ) : (
        <div className="space-y-4">
          {leads.map((lead) => (
            <div key={lead.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 items-center text-sm text-slate-500">
                    <span className="font-semibold text-slate-700">Lead ID:</span> {lead.id}
                    <span className="font-semibold text-slate-700">Phone:</span> {lead.phone}
                    <span className="font-semibold text-slate-700">Status:</span> {lead.status || "pending"}
                    {lead.assigned_to && (
                      <>
                        <span className="font-semibold text-slate-700">Assigned:</span>
                        <span>{lead.assigned_to}</span>
                      </>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-xs uppercase tracking-widest text-slate-400">Callback Time</div>
                      <div className="mt-1 text-sm text-slate-700">{lead.callback_time || "Not scheduled"}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-xs uppercase tracking-widest text-slate-400">Human request</div>
                      <div className="mt-1 text-sm text-slate-700">{lead.human_now ? "Immediate" : "Wait until scheduled time"}</div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => assignSelf(lead.id)}>Assign to me</Button>
                  {lead.status !== "closed" && <Button size="sm" variant="outline" onClick={() => updateStatus(lead.id, "assigned")}>Mark Assigned</Button>}
                  {lead.status !== "closed" && <Button size="sm" variant="outline" onClick={() => updateStatus(lead.id, "closed")}>Mark Closed</Button>}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-widest text-slate-400">Request Note</div>
                  <div className="mt-2 text-sm text-slate-700">{lead.request_note || "No note provided."}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-widest text-slate-400">Voice Chat</div>
                  <div className="mt-2 text-sm text-slate-700">{lead.voice_requested ? "Requested" : "Not requested"}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-widest text-slate-400">Language</div>
                  <div className="mt-2 text-sm text-slate-700">{lead.language || "—"}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-widest text-slate-400">Industry</div>
                  <div className="mt-2 text-sm text-slate-700">{lead.industry || "—"}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-widest text-slate-400">Sector</div>
                  <div className="mt-2 text-sm text-slate-700">{lead.sector || "—"}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
