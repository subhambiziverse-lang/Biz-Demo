import React, { useEffect, useState } from "react";
import api from "../../lib/api";

export default function CoveragePage() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/admin/coverage").then(r => setRows(r.data.rows||[])); }, []);
  const colorOf = (s) => s==="green"?"bg-emerald-500":s==="yellow"?"bg-amber-500":"bg-red-500";
  return (
    <div className="p-8">
      <h1 className="font-display text-3xl font-black text-secondary">Video Coverage</h1>
      <p className="text-slate-500 text-sm mt-1">Green = configured combination flow · Amber = individual fallback only · Red = no video.</p>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mt-6">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500"><tr><th className="text-left p-4">Status</th><th className="text-left p-4">Business Type</th><th className="text-left p-4">Product</th><th className="text-left p-4">Available Modules</th><th className="text-left p-4">Flows</th></tr></thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} className="border-t border-slate-100">
                <td className="p-4"><span className={`inline-block h-3 w-3 rounded-full ${colorOf(r.status)}`} /></td>
                <td className="p-4 font-semibold">{r.business_type}</td>
                <td className="p-4">{r.product_category}</td>
                <td className="p-4 text-xs">{r.available_modules.join(", ") || "—"}</td>
                <td className="p-4">{r.flows_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
