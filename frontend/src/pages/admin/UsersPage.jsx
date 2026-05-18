import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";

const DEFAULT_FORM = {
  user_id: "",
  email: "",
  name: "",
  role: "agent",
  password: "",
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/users");
      setUsers(res.data);
    } catch (err) {
      toast.error("Unable to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createUser = async () => {
    if (!form.user_id || !form.password) {
      toast.error("User ID and password are required");
      return;
    }
    try {
      await api.post("/admin/users", form);
      toast.success("User created");
      setForm(DEFAULT_FORM);
      load();
    } catch (err) {
      toast.error("Failed to create user");
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm(`Delete user ${userId}?`)) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success("User deleted");
      load();
    } catch (err) {
      toast.error("Failed to delete user");
    }
  };

  return (
    <div className="p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-black text-secondary">Admin Users</h1>
          <p className="text-slate-500 text-sm">Create and manage human agent accounts for live chat and lead handling.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">New Admin / Agent</h2>
          <div className="grid gap-4">
            <label className="block">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1">User ID</div>
              <input value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2" />
            </label>
            <label className="block">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1">Email</div>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2" />
            </label>
            <label className="block">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1">Name</div>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2" />
            </label>
            <label className="block">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1">Role</div>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2">
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label className="block">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1">Password</div>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2" />
            </label>
            <Button onClick={createUser}>Create user</Button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Existing Users</h2>
          <div className="space-y-4">
            {users.length === 0 ? (
              <div className="text-sm text-slate-500">No admin users found.</div>
            ) : (
              users.map((user) => (
                <div key={user.user_id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{user.name || user.user_id}</div>
                      <div className="text-xs text-slate-500">{user.user_id} · {user.email || "No email"} · {user.role}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => deleteUser(user.user_id)}>Delete</Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
