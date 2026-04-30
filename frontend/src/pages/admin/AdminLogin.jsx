import React from "react";
import { Button } from "../../components/ui/button";
import { LogIn } from "lucide-react";

export default function AdminLogin() {
  const goGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/admin";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };
  return (
    <div className="min-h-screen bg-secondary bg-grid-dark grid place-items-center px-6">
      <div className="bg-white rounded-3xl p-10 max-w-md w-full shadow-2xl">
        <div className="font-display font-black text-2xl text-secondary">Biziverse Admin</div>
        <p className="text-slate-500 text-sm mt-1">Internal team access only.</p>
        <Button data-testid="google-signin" onClick={goGoogle} className="w-full mt-8 bg-secondary hover:bg-secondary/90 text-white rounded-full h-12 font-bold">
          <LogIn className="h-4 w-4 mr-2" /> Sign in with Google
        </Button>
      </div>
    </div>
  );
}
