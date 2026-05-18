import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { LogIn, User, Lock } from "lucide-react";
import { toast } from "sonner";

export default function AdminLogin() {
  const nav = useNavigate();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const goGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/admin";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!userId.trim() || !password) { toast.error("Enter username and password"); return; }
    setLoading(true);
    try {
      await api.post("/auth/login", { user_id: userId.trim(), password });
      toast.success("Welcome back!");
      nav("/admin");
    } catch (err) {
      const msg = err?.response?.data?.detail || "Invalid credentials";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary bg-grid-dark grid place-items-center px-6">
      <div className="bg-white rounded-3xl p-10 max-w-md w-full shadow-2xl">
        <div className="font-display font-black text-2xl text-secondary">Biziverse Admin</div>
        <p className="text-slate-500 text-sm mt-1">Internal team access only.</p>

        <form onSubmit={submit} className="mt-7 space-y-3">
          <div className="relative">
            <User className="h-4 w-4 absolute left-3 top-3.5 text-slate-400" />
            <input
              data-testid="admin-userid"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Username"
              autoFocus
              className="w-full pl-9 pr-3 py-2.5 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-orange-500"
              autoComplete="username"
            />
          </div>
          <div className="relative">
            <Lock className="h-4 w-4 absolute left-3 top-3.5 text-slate-400" />
            <input
              data-testid="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pl-9 pr-3 py-2.5 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-orange-500"
              autoComplete="current-password"
            />
          </div>
          <Button
            data-testid="admin-login-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-full h-11 font-bold disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 flex items-center gap-3 text-xs text-slate-400">
          <div className="flex-1 h-px bg-slate-200" />
          <span>or</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <Button
          data-testid="google-signin"
          variant="outline"
          onClick={goGoogle}
          className="w-full mt-5 rounded-full h-11 font-medium"
        >
          <LogIn className="h-4 w-4 mr-2" /> Sign in with Google
        </Button>
      </div>
    </div>
  );
}
