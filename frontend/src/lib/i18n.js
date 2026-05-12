// Simple translation dictionary. UI text only — narrations come from backend.
// LANGS is now mutable and gets hydrated from /api/languages at app boot.
// Callers should re-read it after `loadLanguages()` resolves, or import the helper.
export let LANGS = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "mr", label: "Marathi", native: "मराठी" },
];

const LANG_LISTENERS = new Set();
export function onLanguagesChange(fn) {
  LANG_LISTENERS.add(fn);
  return () => LANG_LISTENERS.delete(fn);
}

export async function loadLanguages() {
  try {
    const base = process.env.REACT_APP_BACKEND_URL;
    if (!base) return LANGS;
    const r = await fetch(`${base}/api/languages`);
    if (!r.ok) return LANGS;
    const data = await r.json();
    if (Array.isArray(data.languages) && data.languages.length > 0) {
      LANGS = data.languages;
      LANG_LISTENERS.forEach(fn => { try { fn(LANGS); } catch(_) {} });
    }
  } catch (_) { /* fallback to defaults */ }
  return LANGS;
}

export const TR = {
  en: {
    headline: "See how this software works for your business in 2 minutes",
    subheadline: "An AI-guided product tour built for Indian wholesalers, distributors, retailers and manufacturers. No demo call needed.",
    start_demo: "Start Demo",
    trusted_by: "Trusted by Indian businesses",
    q1: "What type of business do you run?",
    q2: "What do you sell?",
    q3: "Which areas do you want to manage?",
    back: "Back",
    next: "Next",
    select_one: "Select one option",
    select_modules: "Select one or more modules",
    pause: "Pause",
    play: "Play",
    try_yourself: "Try Yourself",
    resume_demo: "Resume Demo",
    ask_anything: "Ask anything about Biziverse…",
    send: "Send",
    voice_on: "Voice On", voice_off: "Voice Off",
    summary_title: "Start managing your business like this today",
    sales_total: "Total Sales", pending: "Pending Payments", recovered: "Recovered This Month",
    start_free_trial: "Start Free Trial", get_full_access: "Get Full Access",
    enter_mobile: "Enter your mobile number", enter_otp: "Enter the OTP",
    send_otp: "Send OTP", verify_otp: "Verify OTP",
    monthly: "₹999 / month", yearly: "₹9,999 / year",
    pay_now: "Pay Now",
    onboarding_title: "Let's set up your business in 2 minutes",
    add_first_customer: "Add first customer", add_first_product: "Add first product", create_first_invoice: "Create first invoice",
    skip: "Skip", finish: "Finish",
    need_help: "Want help setting this up?",
    chat: "Chat", call: "Call", schedule_demo: "Schedule Demo",
    privacy: "Privacy",
    now_showing: "Now showing",
    want_try: "Want to try this yourself?",
    yes: "Yes", not_now: "Not now",
  },
  hi: {
    headline: "देखें यह सॉफ्टवेयर आपके व्यवसाय के लिए 2 मिनट में कैसे काम करता है",
    subheadline: "भारतीय थोक व्यापारियों, वितरकों, खुदरा और निर्माताओं के लिए बना AI-गाइडेड टूर। डेमो कॉल की जरूरत नहीं।",
    start_demo: "डेमो शुरू करें",
    trusted_by: "भारतीय व्यवसायों द्वारा भरोसेमंद",
    q1: "आप किस प्रकार का व्यवसाय करते हैं?",
    q2: "आप क्या बेचते हैं?",
    q3: "आप किन क्षेत्रों का प्रबंधन करना चाहते हैं?",
    back: "वापस", next: "आगे",
    select_one: "एक विकल्प चुनें",
    select_modules: "एक या अधिक मॉड्यूल चुनें",
    pause: "रोकें", play: "चलाएँ",
    try_yourself: "खुद आज़माएं", resume_demo: "डेमो जारी रखें",
    ask_anything: "Biziverse के बारे में कुछ भी पूछें…",
    send: "भेजें",
    voice_on: "आवाज़ चालू", voice_off: "आवाज़ बंद",
    summary_title: "आज ही अपना व्यवसाय इस तरह प्रबंधित करना शुरू करें",
    sales_total: "कुल बिक्री", pending: "बकाया भुगतान", recovered: "इस महीने वसूला",
    start_free_trial: "नि:शुल्क ट्रायल", get_full_access: "पूर्ण एक्सेस लें",
    enter_mobile: "अपना मोबाइल नंबर दर्ज करें", enter_otp: "OTP दर्ज करें",
    send_otp: "OTP भेजें", verify_otp: "OTP सत्यापित करें",
    monthly: "₹999 / माह", yearly: "₹9,999 / वर्ष", pay_now: "अभी भुगतान करें",
    onboarding_title: "चलिए आपका व्यवसाय 2 मिनट में सेट करते हैं",
    add_first_customer: "पहला ग्राहक जोड़ें", add_first_product: "पहला उत्पाद जोड़ें", create_first_invoice: "पहला चालान बनाएं",
    skip: "छोड़ें", finish: "समाप्त",
    need_help: "सेटअप में मदद चाहिए?", chat: "चैट", call: "कॉल", schedule_demo: "डेमो शेड्यूल करें",
    privacy: "गोपनीयता", now_showing: "अब दिखा रहे हैं",
    want_try: "क्या आप खुद आज़माना चाहेंगे?", yes: "हाँ", not_now: "अभी नहीं",
  },
  gu: {
    headline: "જુઓ આ સોફ્ટવેર તમારા વ્યવસાય માટે 2 મિનિટમાં કેવી રીતે કામ કરે છે",
    subheadline: "ભારતીય જથ્થાબંધ વેપારીઓ, વિતરકો, છૂટક અને ઉત્પાદકો માટે AI-ગાઇડેડ ટૂર.",
    start_demo: "ડેમો શરૂ કરો",
    trusted_by: "ભારતીય વ્યવસાયો દ્વારા વિશ્વસનીય",
    q1: "તમે કયા પ્રકારનો વ્યવસાય કરો છો?",
    q2: "તમે શું વેચો છો?",
    q3: "તમે કયા વિસ્તારોનું સંચાલન કરવા માંગો છો?",
    back: "પાછળ", next: "આગળ",
    select_one: "એક વિકલ્પ પસંદ કરો",
    select_modules: "એક અથવા વધુ મોડ્યુલ પસંદ કરો",
    pause: "થોભો", play: "ચલાવો",
    try_yourself: "જાતે અજમાવો", resume_demo: "ડેમો ચાલુ રાખો",
    ask_anything: "Biziverse વિશે કંઈપણ પૂછો…",
    send: "મોકલો",
    voice_on: "અવાજ ચાલુ", voice_off: "અવાજ બંધ",
    summary_title: "આજથી જ તમારો વ્યવસાય આ રીતે મેનેજ કરો",
    sales_total: "કુલ વેચાણ", pending: "બાકી ચૂકવણી", recovered: "આ મહિને વસૂલ",
    start_free_trial: "મફત ટ્રાયલ", get_full_access: "પૂરો એક્સેસ",
    enter_mobile: "તમારો મોબાઇલ નંબર દાખલ કરો", enter_otp: "OTP દાખલ કરો",
    send_otp: "OTP મોકલો", verify_otp: "OTP ચકાસો",
    monthly: "₹999 / મહિને", yearly: "₹9,999 / વર્ષ", pay_now: "હવે ચૂકવો",
    onboarding_title: "ચાલો તમારો વ્યવસાય 2 મિનિટમાં સેટ કરીએ",
    add_first_customer: "પ્રથમ ગ્રાહક ઉમેરો", add_first_product: "પ્રથમ ઉત્પાદન", create_first_invoice: "પ્રથમ ચલણ બનાવો",
    skip: "છોડો", finish: "પૂર્ણ",
    need_help: "સેટઅપમાં મદદ જોઈએ?", chat: "ચેટ", call: "કૉલ", schedule_demo: "ડેમો શેડ્યૂલ",
    privacy: "ગોપનીયતા", now_showing: "હવે બતાવી રહ્યું",
    want_try: "જાતે અજમાવશો?", yes: "હા", not_now: "હમણાં નહીં",
  },
  mr: {
    headline: "हे सॉफ्टवेअर तुमच्या व्यवसायासाठी 2 मिनिटांत कसे काम करते ते पहा",
    subheadline: "भारतीय घाऊक व्यापारी, वितरक, किरकोळ आणि उत्पादकांसाठी AI-मार्गदर्शित टूर.",
    start_demo: "डेमो सुरू करा",
    trusted_by: "भारतीय व्यवसायांचा विश्वास",
    q1: "तुम्ही कोणत्या प्रकारचा व्यवसाय करता?",
    q2: "तुम्ही काय विकता?",
    q3: "तुम्हाला कोणते क्षेत्र व्यवस्थापित करायचे आहे?",
    back: "मागे", next: "पुढे",
    select_one: "एक पर्याय निवडा",
    select_modules: "एक किंवा अधिक मॉड्यूल",
    pause: "थांबवा", play: "चालवा",
    try_yourself: "स्वतः वापरा", resume_demo: "डेमो पुन्हा सुरू",
    ask_anything: "Biziverse विषयी काहीही विचारा…",
    send: "पाठवा",
    voice_on: "आवाज चालू", voice_off: "आवाज बंद",
    summary_title: "आजपासूनच आपला व्यवसाय असा व्यवस्थापित करा",
    sales_total: "एकूण विक्री", pending: "बाकी पेमेंट", recovered: "या महिन्यात वसूल",
    start_free_trial: "मोफत ट्रायल", get_full_access: "पूर्ण प्रवेश",
    enter_mobile: "मोबाइल नंबर टाका", enter_otp: "OTP टाका",
    send_otp: "OTP पाठवा", verify_otp: "OTP तपासा",
    monthly: "₹999 / महिना", yearly: "₹9,999 / वर्ष", pay_now: "आता भरा",
    onboarding_title: "2 मिनिटांत तुमचा व्यवसाय सेट करूया",
    add_first_customer: "पहिला ग्राहक", add_first_product: "पहिले उत्पादन", create_first_invoice: "पहिले बिल",
    skip: "वगळा", finish: "पूर्ण",
    need_help: "सेटअपसाठी मदत?", chat: "चॅट", call: "कॉल", schedule_demo: "डेमो शेड्यूल",
    privacy: "गोपनीयता", now_showing: "आता दाखवत आहे",
    want_try: "स्वतः वापरून पहा?", yes: "होय", not_now: "आता नाही",
  },
};

export function t(lang, key) {
  return (TR[lang] && TR[lang][key]) || TR.en[key] || key;
}
