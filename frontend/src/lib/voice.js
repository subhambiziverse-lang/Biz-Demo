// Web Speech API wrapper
const LANG_MAP = { en: "en-IN", hi: "hi-IN", gu: "gu-IN", mr: "mr-IN" };

export const voice = {
  enabled: true,
  speaking: false,
  speak(text, lang = "en", onEnd) {
    try {
      if (!this.enabled || !window.speechSynthesis || !text) {
        if (onEnd) setTimeout(onEnd, Math.min(text.length * 50, 4000));
        return;
      }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = LANG_MAP[lang] || "en-IN";
      u.rate = 1.0;
      u.pitch = 1.0;
      u.onend = () => { this.speaking = false; if (onEnd) onEnd(); };
      u.onerror = () => { this.speaking = false; if (onEnd) onEnd(); };
      this.speaking = true;
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.error("voice err", e);
      if (onEnd) onEnd();
    }
  },
  stop() {
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (_) {}
    this.speaking = false;
  },
  setEnabled(b) { this.enabled = b; if (!b) this.stop(); }
};
