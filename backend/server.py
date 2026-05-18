"""Smart Guided Demo - Biziverse - Full Backend (Optimized)."""
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Header, Cookie, Response, Request, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from fastapi import Depends
from fastapi import WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, io, json, random, string, requests, time, csv, hashlib, hmac, binascii
import io as _io
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage
import re as _re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
APP_NAME = os.environ.get("APP_NAME", "biziverse-demo")
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Biziverse Smart Guided Demo")
api = APIRouter(prefix="/api")

# ========== In-Memory Caches ==========
# Avoids hitting MongoDB on every single chat message
_kb_cache: Optional[List[Dict]] = None
_kb_cache_ts: float = 0
KB_CACHE_TTL = 120  # seconds — refresh every 2 min

_module_labels_cache: Optional[Dict] = None
_module_labels_ts: float = 0
LABELS_CACHE_TTL = 300  # 5 minutes

async def get_kb_entries_cached() -> List[Dict]:
    global _kb_cache, _kb_cache_ts
    now = time.monotonic()
    if _kb_cache is not None and (now - _kb_cache_ts) < KB_CACHE_TTL:
        return _kb_cache
    entries = await db.kb_entries.find({"active": True}, {"_id": 0}).to_list(500)
    _kb_cache = entries
    _kb_cache_ts = now
    return entries

def invalidate_kb_cache():
    global _kb_cache
    _kb_cache = None


# ── Simple WebSocket manager for live lead channels ──
class WSManager:
    def __init__(self):
        self._conns: Dict[str, List[WebSocket]] = {}

    async def connect(self, channel: str, websocket: WebSocket):
        await websocket.accept()
        self._conns.setdefault(channel, []).append(websocket)

    def disconnect(self, channel: str, websocket: WebSocket):
        conns = self._conns.get(channel) or []
        if websocket in conns:
            conns.remove(websocket)
        if not conns and channel in self._conns:
            del self._conns[channel]

    async def broadcast(self, channel: str, payload: Dict[str, Any]):
        conns = list(self._conns.get(channel, []))
        if not conns:
            return
        text = json.dumps(payload)
        for ws in conns:
            try:
                await ws.send_text(text)
            except Exception:
                logger.exception("WebSocket send failed")


ws_manager = WSManager()

DEFAULT_LLM_MODELS = {
    "openai": [
        "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-5.2", "gpt-5.1", "gpt-4.1-advanced"
    ],
    "anthropic": [
        "claude-3.5", "claude-3.5-100k", "claude-4", "claude-instant"
    ]
}

DEFAULT_AI_SETTINGS = {
    "enabled": True,
    "name": "Biziverse AI",
    "avatar_url": "https://biziverse.com/WebExt/img/logo2.jpg",
    "primary_color": "#f97316",
    "secondary_color": "#0f172a",
    "background_color": "#ffffff",
    "greeting": {
        "en": "Hi! I can answer questions about Biziverse. What would you like to know?",
        "hi": "नमस्ते! मैं Biziverse के बारे में सवालों के जवाब दे सकता हूँ। आप क्या जानना चाहेंगे?",
        "gu": "નમસ્તે! હું Biziverse વિશે પ્રશ્નોના જવાબ આપી શકું છું.",
        "mr": "नमस्कार! मी Biziverse विषयी प्रश्नांची उत्तरे देऊ शकतो."
    },
    "executive_response": {
        "en": "Sure! Our team will be happy to connect with you. Please use the button below to talk with an executive.",
        "hi": "बिल्कुल! हमारी टीम आपसे बात करने में खुश होगी। नीचे दिए बटन से executive से बात करें।",
        "gu": "ચોક્કસ! અમારી ટીમ તમારા સાથે વાત કરવા માટે ખુશ રહેશે. નીચે બટન પર ક્લિક કરો.",
        "mr": "नक्कीच! आमची टीम तुमच्याशी बोलण्यास तयार आहे. खालील बटणाचा वापर करा."
    },
    "pricing_response": {
        "en": "For pricing details and the best plan for your business, our team would love to walk you through it personally.",
        "hi": "आपके व्यापार के लिए सही plan और pricing जानने के लिए हमारी team से बात करें।",
        "gu": "તમારા વ્યવસાય માટે યોગ્ય પ્લાન અને પ્રાઇસિંગ જાણવા માટે અમારી ટીમ સાથે વાત કરો.",
        "mr": "तुमच्या व्यवसायासाठी योग्य योजना आणि किंमत जाणून घेण्यासाठी आमच्या टीमशी बोला."
    },
    "fallback_response": {
        "en": "I don't have an answer for that yet. Would you like to talk with an executive?",
        "hi": "मेरे पास इसका जवाब अभी नहीं है। क्या आप किसी executive से बात करना चाहेंगे?",
        "gu": "મારે પાસે આ જવાબ હજુ ન હતું. શું તમે executive સાથે વાત કરવા માંગો છો?",
        "mr": "माझ्याकडे या प्रश्नाचे उत्तर अद्याप नाही. कार्यकारीशी बोलू इच्छिता?"
    },
    "show_exec_cta_on_direct_intent": True,
    "show_exec_cta_on_no_answer": True,
    "show_exec_cta_on_ambiguous": False,
    "llm_model": {"provider": "openai", "model": "gpt-4o-mini"},
    "api_key": ""
}

DEFAULT_SETTINGS = {
    "show_executive_cta": True,
    "executive_phone": "",
    "ai_settings": DEFAULT_AI_SETTINGS
}

def merge_ai_settings(raw: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    merged = {**DEFAULT_AI_SETTINGS}
    if not isinstance(raw, dict):
        return merged
    for key, value in raw.items():
        if key in {"greeting", "executive_response", "pricing_response", "fallback_response"}:
            merged[key] = {**DEFAULT_AI_SETTINGS[key], **(value or {})}
        elif key == "llm_model" and isinstance(value, dict):
            merged[key] = {**DEFAULT_AI_SETTINGS["llm_model"], **value}
        else:
            merged[key] = value
    return merged

async def get_main_settings() -> Dict[str, Any]:
    doc = await db.settings.find_one({"_id": "main"}, {"_id": 0}) or {}
    ai_settings = merge_ai_settings(doc.get("ai_settings", {}))
    result = {
        "show_executive_cta": doc.get("show_executive_cta", DEFAULT_SETTINGS["show_executive_cta"]),
        "executive_phone": doc.get("executive_phone", DEFAULT_SETTINGS["executive_phone"]),
        "ai_settings": ai_settings
    }
    for k, v in doc.items():
        if k not in result:
            result[k] = v
    return result

# ========== Auth Helpers ==========
PASSWORD_ITERATIONS = 120000

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return f"{binascii.hexlify(salt).decode()}${binascii.hexlify(dk).decode()}"

def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_hex, hash_hex = stored_hash.split("$")
        salt = binascii.unhexlify(salt_hex)
        expected = binascii.unhexlify(hash_hex)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False

class CallbackRequestIn(BaseModel):
    phone: str
    callback_time: str                    # ISO datetime string
    session_id: Optional[str] = None
    business_type: Optional[str] = None
    product_category: Optional[str] = None
    modules_watched: Optional[List[str]] = []
    questions_asked: Optional[List[str]] = []
    language: Optional[str] = "en"
    human_now: Optional[bool] = False
    voice_requested: Optional[bool] = False
    request_note: Optional[str] = None

class LiveLeadMessageIn(BaseModel):
    role: str
    type: str = "text"
    text: Optional[str] = None
    audio_data: Optional[str] = None

class LiveLeadUpdateIn(BaseModel):
    assigned_to: Optional[str] = None
    status: Optional[str] = None
    industry: Optional[str] = None
    sector: Optional[str] = None

class AuthLoginIn(BaseModel):
    user_id: str
    password: str

class AdminUserIn(BaseModel):
    user_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = "agent"
    password: Optional[str] = None

class AdminUserUpdateIn(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None

# ========== Object Storage ==========
_storage_key = None
def init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        logger.info("Storage initialized")
        return _storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str):
    key = init_storage()
    if not key:
        raise HTTPException(503, "Storage unavailable")
    r = requests.put(f"{STORAGE_URL}/objects/{path}",
                     headers={"X-Storage-Key": key, "Content-Type": content_type},
                     data=data, timeout=300)
    r.raise_for_status()
    return r.json()

def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(503, "Storage unavailable")
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=120)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")

# ========== Auth Helpers ==========
async def get_current_admin(session_token: Optional[str] = Cookie(None),
                            authorization: Optional[str] = Header(None)):
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(401, "Invalid session")
    expires_at = sess["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(401, "Session expired")
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

async def admin_dep(session_token: Optional[str] = Cookie(None),
                    authorization: Optional[str] = Header(None)):
    return await get_current_admin(session_token=session_token, authorization=authorization)

# ========== Models ==========
class GoogleAuthIn(BaseModel):
    session_id: str

class QuizSubmit(BaseModel):
    business_type: str
    product_category: str
    modules: List[str]
    session_id: Optional[str] = None
    language: Optional[str] = "en"

class EventIn(BaseModel):
    session_id: str
    event_type: str
    payload: Optional[Dict[str, Any]] = {}

class ChatIn(BaseModel):
    session_id: str
    message: str
    language: str = "en"
    business_type: Optional[str] = None
    product_category: Optional[str] = None
    modules: Optional[List[str]] = []
    current_step: Optional[int] = 0

class OTPSendIn(BaseModel):
    mobile: str

class OTPVerifyIn(BaseModel):
    mobile: str
    otp: str
    session_id: Optional[str] = None

class PaymentIn(BaseModel):
    mobile: str
    plan: str  # "monthly" | "yearly"

class VideoMarker(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float
    pause_duration: float = 0
    highlight: Optional[Dict[str, Any]] = None
    cursor: Optional[Dict[str, float]] = None
    narration: Dict[str, str] = {}

class ModuleVideoIn(BaseModel):
    model_config = {"extra": "allow"}
    module_key: str
    title: str
    video_url: str = ""
    storage_path: str = ""
    duration: float = 0
    markers: List[Dict[str, Any]] = []
    chapters: List[Dict[str, Any]] = []
    published: bool = False
    biziverse_url: Optional[str] = None
    show_try_yourself: bool = True
    target_languages: List[str] = []
    target_business_types: List[str] = []
    target_product_categories: List[str] = []
    primary_language: Optional[str] = None

class FlowIn(BaseModel):
    business_type: str
    product_category: str
    modules: List[str]
    name: str
    video_sequence: List[str] = []
    transition_text: Dict[str, str] = {}
    status: str = "draft"

class KBEntryIn(BaseModel):
    question: str
    answers: Dict[str, str] = {}
    tags: List[str] = []
    video_url: Optional[str] = None
    video_start: Optional[float] = None
    video_end: Optional[float] = None
    active: bool = True

class QuizOptionsIn(BaseModel):
    business_types: List[Dict[str, Any]]
    product_categories: Dict[str, List[Dict[str, Any]]]
    modules: Dict[str, List[str]]

# ========== Auth Routes ==========
@api.post("/auth/google-callback")
async def google_callback(payload: GoogleAuthIn, response: Response):
    try:
        r = requests.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                         headers={"X-Session-ID": payload.session_id}, timeout=15)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        raise HTTPException(401, f"Auth failed: {e}")

    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id},
                                  {"$set": {"name": data.get("name"), "picture": data.get("picture")}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", ""),
            "picture": data.get("picture", ""),
            "role": "editor",
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    session_token = data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    response.set_cookie("session_token", session_token, max_age=7*24*3600,
                        httponly=True, secure=True, samesite="none", path="/")
    return {"user_id": user_id, "email": email, "name": data.get("name", ""), "picture": data.get("picture", "")}

@api.get("/auth/me")
async def auth_me_real(session_token: Optional[str] = Cookie(None),
                       authorization: Optional[str] = Header(None)):
    user = await get_current_admin(session_token=session_token, authorization=authorization)
    return {k: user.get(k) for k in ("user_id", "email", "name", "picture", "role")}

@api.post("/auth/logout")
async def logout(response: Response, session_token: Optional[str] = Cookie(None)):
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

# ========== Quiz / Demo Resolution ==========
DEFAULT_QUIZ = {
    "business_types": [
        {"key": "wholesale", "label": {"en": "Wholesale Trader", "hi": "थोक व्यापारी", "gu": "જથ્થાબંધ વેપારી", "mr": "घाऊक व्यापारी"}},
        {"key": "distributor", "label": {"en": "Distributor", "hi": "वितरक / डीलर", "gu": "વિતરક / ડીલર", "mr": "वितरक / डीलर"}},
        {"key": "retail", "label": {"en": "Retail Store", "hi": "खुदरा दुकान", "gu": "છૂટક દુકાન", "mr": "किरकोळ दुकान"}},
        {"key": "manufacturer", "label": {"en": "Manufacturer", "hi": "निर्माता / उत्पादक", "gu": "ઉત્પાદક", "mr": "उत्पादक"}},
        {"key": "service", "label": {"en": "Service Provider", "hi": "सेवा प्रदाता", "gu": "સેવા પ્રદાતા", "mr": "सेवा प्रदाता"}},
        {"key": "ecom", "label": {"en": "E-commerce Seller", "hi": "ई-कॉमर्स विक्रेता", "gu": "ઈ-કોમર્સ વિક્રેતા", "mr": "ई-कॉमर्स विक्रेता"}},
        {"key": "contractor", "label": {"en": "Contractor", "hi": "ठेकेदार", "gu": "કોન્ટ્રાક્ટર", "mr": "कंत्राटदार"}},
    ],
    "product_categories": {
        "wholesale": [
            {"key": "textiles", "label": {"en": "Textiles & Apparel", "hi": "कपड़ा एवं वस्त्र", "gu": "કાપડ અને વસ્ત્ર", "mr": "कापड व वस्त्र"}},
            {"key": "electronics", "label": {"en": "Electronics", "hi": "इलेक्ट्रॉनिक्स", "gu": "ઇલેક્ટ્રોનિક્સ", "mr": "इलेक्ट्रॉनिक्स"}},
            {"key": "fmcg", "label": {"en": "FMCG / Groceries", "hi": "FMCG / किराना", "gu": "FMCG / કરિયાણા", "mr": "FMCG / किराणा"}},
            {"key": "hardware", "label": {"en": "Hardware & Tools", "hi": "हार्डवेयर एवं औज़ार", "gu": "હાર્ડવેર અને ઓજારો", "mr": "हार्डवेअर व साधने"}},
            {"key": "stationery", "label": {"en": "Stationery & Books", "hi": "स्टेशनरी एवं किताबें", "gu": "સ્ટેશનરી અને પુસ્તકો", "mr": "स्टेशनरी व पुस्तके"}},
            {"key": "other_w", "label": {"en": "Other", "hi": "अन्य", "gu": "અન્ય", "mr": "इतर"}},
        ],
        "distributor": [
            {"key": "fmcg", "label": {"en": "FMCG", "hi": "FMCG", "gu": "FMCG", "mr": "FMCG"}},
            {"key": "pharma", "label": {"en": "Pharma & Healthcare", "hi": "दवाइयाँ / फार्मा", "gu": "ફાર્મા / દવા", "mr": "फार्मा / औषध"}},
            {"key": "auto", "label": {"en": "Auto Parts & Spares", "hi": "ऑटो पार्ट्स", "gu": "ઓટો સ્પેર પાર્ટ્સ", "mr": "ऑटो स्पेअर्स"}},
            {"key": "electronics_d", "label": {"en": "Consumer Electronics", "hi": "इलेक्ट्रॉनिक्स", "gu": "ઇલેક્ટ્રોનिक्स", "mr": "इलेक्ट्रॉनिक्स"}},
            {"key": "agri_inputs", "label": {"en": "Agri Inputs (Seed, Fertiliser)", "hi": "कृषि सामग्री (बीज, खाद)", "gu": "કૃષિ સામગ્રી (બીજ, ખાતર)", "mr": "कृषी निविष्ठा (बी-बियाणे, खते)"}},
            {"key": "other_d", "label": {"en": "Other", "hi": "अन्य", "gu": "અन्य", "mr": "इतर"}},
        ],
        "retail": [
            {"key": "kirana", "label": {"en": "Kirana / Grocery", "hi": "किराना / जनरल स्टोर", "gu": "કિરાણા / જનરલ સ્ટોર", "mr": "किराणा / जनरल स्टोअर"}},
            {"key": "fashion", "label": {"en": "Fashion & Apparel", "hi": "फैशन / कपड़े", "gu": "ફેશન / કપડાં", "mr": "फॅशन / कपडे"}},
            {"key": "mobile", "label": {"en": "Mobile & Electronics", "hi": "मोबाइल / इलेक्ट्रॉनिक्स", "gu": "મોબાઈલ / ઇલેક્ટ્રોનिक्स", "mr": "मोबाईल / इलेक्ट्रॉनिक्स"}},
            {"key": "medical", "label": {"en": "Medical Store / Pharmacy", "hi": "मेडिकल स्टोर", "gu": "મેડિકલ સ્ટોર", "mr": "मेडिकल स्टोअर"}},
            {"key": "jewellery", "label": {"en": "Jewellery", "hi": "जेवर / आभूषण", "gu": "ઝવેરાત", "mr": "दागिने"}},
            {"key": "other_r", "label": {"en": "Other", "hi": "अन्य", "gu": "અन्य", "mr": "इतर"}},
        ],
        "manufacturer": [
            {"key": "engineering", "label": {"en": "Engineering / Fabrication", "hi": "इंजीनियरिंग / फैब्रिकेशन", "gu": "એન્જિનિયरिंग / ફेบ્રिकेশन", "mr": "इंजिनीअरिंग / फॅब्रिकेशन"}},
            {"key": "food", "label": {"en": "Food Processing", "hi": "खाद्य प्रसंस्करण", "gu": "ફૂડ પ્રોसेसिंग", "mr": "अन्न प्रक्रिया"}},
            {"key": "chemicals", "label": {"en": "Chemicals", "hi": "रसायन", "gu": "રसायण", "mr": "रसायने"}},
            {"key": "pharma_m", "label": {"en": "Pharma Manufacturing", "hi": "फार्मा निर्माण", "gu": "ફાર્મા ઉत्पादन", "mr": "फार्मा उत्पादन"}},
            {"key": "textile_m", "label": {"en": "Textile / Garment", "hi": "टेक्सटाइल / गारमेंट", "gu": "ટेक्सटाइल / ગારमेंट", "mr": "टेक्सटाइल / गारमेंट"}},
            {"key": "plastic", "label": {"en": "Plastic / Packaging", "hi": "प्लास्टिक / पैकेजिंग", "gu": "પ્લास्टिक / પेकेजिंग", "mr": "प्लास्टिक / पॅकेजिंग"}},
            {"key": "other_m", "label": {"en": "Other", "hi": "अन्य", "gu": "અन्य", "mr": "इतर"}},
        ],
        "service": [
            {"key": "it", "label": {"en": "IT Services / Software", "hi": "IT सेवा / सॉफ्टवेयर", "gu": "IT સेवा / સॉफ्टवेयर", "mr": "IT सेवा / सॉफ्टवेअर"}},
            {"key": "consulting", "label": {"en": "Consulting / Professional", "hi": "कंसल्टिंग / प्रोफेशनल", "gu": "કन्सल्टिंग / પ્રोफेशनल", "mr": "कन्सल्टिंग / प्रोफेशनल"}},
            {"key": "logistics", "label": {"en": "Logistics / Transport", "hi": "लॉजिस्टिक्स / ट्रांसपोर्ट", "gu": "લोजिस्टिक्स / ટ્રान्सपोर्ट", "mr": "लॉजिस्टिक्स / वाहतूक"}},
            {"key": "education", "label": {"en": "Education / Training", "hi": "शिक्षा / ट्रेनिंग", "gu": "શिक्षण / તालीम", "mr": "शिक्षण / प्रशिक्षण"}},
            {"key": "hospitality", "label": {"en": "Hospitality / Restaurant", "hi": "हॉस्पिटैलिटी / रेस्तरां", "gu": "હोस्पिटालिटी / રेस्टोरन्ट", "mr": "हॉस्पिटॅलिटी / रेस्टॉरंट"}},
            {"key": "other_s", "label": {"en": "Other", "hi": "अन्य", "gu": "અन्य", "mr": "इतर"}},
        ],
        "ecom": [
            {"key": "fashion_e", "label": {"en": "Fashion & Apparel", "hi": "फैशन / कपड़े", "gu": "ફेशन / કपडां", "mr": "फॅशन / कपडे"}},
            {"key": "electronics_e", "label": {"en": "Electronics & Gadgets", "hi": "इलेक्ट्रॉनिक्स / गैजेट्स", "gu": "ઇलेक्ट्रोनिक्स / ગेजेट्स", "mr": "इलेक्ट्रॉनिक्स / गॅजेट्स"}},
            {"key": "home_e", "label": {"en": "Home & Kitchen", "hi": "होम / किचन", "gu": "ઘर / કिचन", "mr": "घर / स्वयंपाकघर"}},
            {"key": "beauty_e", "label": {"en": "Beauty & Personal Care", "hi": "ब्यूटी / पर्सनल केयर", "gu": "બ્યुटी / પर्सनल केर", "mr": "ब्युटी / पर्सनल केअर"}},
            {"key": "other_e", "label": {"en": "Other", "hi": "अन्य", "gu": "અन्य", "mr": "इतर"}},
        ],
        "contractor": [
            {"key": "construction", "label": {"en": "Construction / Civil", "hi": "निर्माण / सिविल", "gu": "બांधकाम / સिविल", "mr": "बांधकाम / सिव्हिल"}},
            {"key": "interior", "label": {"en": "Interior / Fit-out", "hi": "इंटीरियर / फिट-आउट", "gu": "ઈन्टिरियर / ફिट-आउट", "mr": "इंटिरियर / फिट-आऊट"}},
            {"key": "electrical_c", "label": {"en": "Electrical / Plumbing", "hi": "इलेक्ट्रिकल / प्लंबिंग", "gu": "ઇलेक्ट्रिकल / પ्लम्बिंग", "mr": "इलेक्ट्रिकल / प्लंबिंग"}},
            {"key": "other_c", "label": {"en": "Other", "hi": "अन्य", "gu": "અन्य", "mr": "इतर"}},
        ],
    },
    "modules": {
        "_default": ["crm", "quotes", "sales_orders", "sales_invoices", "recovery", "contracts",
                     "tickets", "customers", "accounts", "purchases", "purchase_orders",
                     "inventory", "manufacturing", "projects", "tasks", "suppliers", "store", "reports"]
    }
}

DEFAULT_MODULE_LABELS = {
    "crm": {"en": "Leads & CRM", "hi": "लीड्स / CRM", "gu": "લીડ્સ / CRM", "mr": "लीड्स / CRM"},
    "quotes": {"en": "Quotes & Proforma Invoice", "hi": "कोटेशन / प्रोफार्मा", "gu": "ક્વોટेशन / પ્રोफोर्मा", "mr": "कोटेशन / प्रोफॉर्मा"},
    "sales_orders": {"en": "Sales Orders", "hi": "बिक्री ऑर्डर", "gu": "વेचाण ऑर्डर", "mr": "विक्री ऑर्डर"},
    "sales_invoices": {"en": "Sales Invoice (GST, e-Invoice, e-Way Bill)", "hi": "बिक्री चालान (GST, e-Invoice, e-Way Bill)", "gu": "વेचाण इन्वोइस (GST, e-Invoice)", "mr": "विक्री इन्व्हॉइस (GST, e-Invoice)"},
    "recovery": {"en": "Payment Recovery & Reminders", "hi": "बकाया वसूली / रिमाइंडर", "gu": "પेमेंट रिकवरी / रिमाइंडर", "mr": "वसुली / रिमाइंडर"},
    "contracts": {"en": "Contracts (AMC & Renewals)", "hi": "कॉन्ट्रैक्ट (AMC / रिन्यूअल)", "gu": "કोन्ट्राक्ट (AMC / रिन्युअल)", "mr": "कॉन्ट्रॅक्ट (AMC / नूतनीकरण)"},
    "tickets": {"en": "Support Tickets", "hi": "सपोर्ट टिकट", "gu": "સपोर्ट टिकिट", "mr": "सपोर्ट तिकीट"},
    "customers": {"en": "Customer Master", "hi": "ग्राहक मास्टर", "gu": "ગ्राहक मास्टर", "mr": "ग्राहक मास्टर"},
    "accounts": {"en": "Accounts & Bookkeeping", "hi": "अकाउंट / बहीखाता", "gu": "એकाउंट / बुककीपिंग", "mr": "अकाउंट / वहीखाते"},
    "purchases": {"en": "Purchases (Invoice, GRN, GSTR3)", "hi": "खरीद (बिल, GRN, GSTR3)", "gu": "ખरीदी (बिल, GRN, GSTR3)", "mr": "खरेदी (बिल, GRN, GSTR3)"},
    "purchase_orders": {"en": "Purchase Orders", "hi": "खरीद ऑर्डर", "gu": "ખरीद ऑर्डर", "mr": "खरेदी ऑर्डर"},
    "inventory": {"en": "Inventory (Batch-wise)", "hi": "इन्वेंटरी (बैच वार)", "gu": "ઈन्वेंटरी (बेच वार)", "mr": "इन्व्हेंटरी (बॅच-वार)"},
    "manufacturing": {"en": "Manufacturing (BOM, Job, Backflush)", "hi": "मैन्युफैक्चरिंग (BOM, जॉब)", "gu": "મेन्युफेक्चरिंग (BOM, जोब)", "mr": "मॅन्युफॅक्चरिंग (BOM, जॉब)"},
    "projects": {"en": "Projects", "hi": "प्रोजेक्ट", "gu": "પ્રोजेक्ट", "mr": "प्रकल्प"},
    "tasks": {"en": "Tasks & Todo", "hi": "टास्क / टू-डू", "gu": "ટास्क / टु-डु", "mr": "टास्क / टू-डू"},
    "suppliers": {"en": "Suppliers Master", "hi": "सप्लायर मास्टर", "gu": "સप्लायर मास्टर", "mr": "सप्लायर मास्टर"},
    "store": {"en": "Your Online Store", "hi": "ऑनलाइन स्टोर", "gu": "ઓनलाइन स्टोर", "mr": "ऑनलाइन स्टोअर"},
    "reports": {"en": "Reports & Analytics", "hi": "रिपोर्ट / एनालिटिक्स", "gu": "રिपोर्ट / एनालिटिक्स", "mr": "रिपोर्ट / अॅनालिटिक्स"},
}

DEFAULT_LANGUAGES = [
    {"code": "en", "label": "English", "native": "English"},
    {"code": "hi", "label": "Hindi", "native": "हिन्दी"},
    {"code": "gu", "label": "Gujarati", "native": "ગુજરાતી"},
    {"code": "mr", "label": "Marathi", "native": "मराठी"},
]

async def get_module_labels() -> Dict[str, Dict[str, str]]:
    global _module_labels_cache, _module_labels_ts
    now = time.monotonic()
    if _module_labels_cache is not None and (now - _module_labels_ts) < LABELS_CACHE_TTL:
        return _module_labels_cache
    doc = await db.module_labels.find_one({"_id": "main"})
    if doc and isinstance(doc.get("labels"), dict):
        merged = {**DEFAULT_MODULE_LABELS}
        for k, v in doc["labels"].items():
            if isinstance(v, dict):
                merged[k] = {**DEFAULT_MODULE_LABELS.get(k, {}), **v}
        _module_labels_cache = merged
    else:
        _module_labels_cache = DEFAULT_MODULE_LABELS
    _module_labels_ts = now
    return _module_labels_cache

MODULE_LABELS = DEFAULT_MODULE_LABELS

WORKFLOW_ORDER = ["crm", "quotes", "sales_orders", "sales_invoices", "recovery", "contracts",
                  "tickets", "customers", "purchase_orders", "purchases", "inventory",
                  "manufacturing", "suppliers", "projects", "tasks", "accounts", "store", "reports"]

@api.get("/quiz/options")
async def quiz_options(business_type: Optional[str] = None, product_category: Optional[str] = None):
    cfg = await db.quiz_config.find_one({"_id": "main"}, {"_id": 0}) or DEFAULT_QUIZ
    if not business_type:
        return {"business_types": cfg["business_types"]}
    if business_type and not product_category:
        return {"product_categories": cfg["product_categories"].get(business_type, [])}
    pub_videos = await db.module_videos.find({"published": True}, {"_id": 0, "module_key": 1}).to_list(1000)
    available_modules = list({v["module_key"] for v in pub_videos})
    cfg_mods = cfg.get("modules", {}).get(f"{business_type}|{product_category}") or cfg.get("modules", {}).get("_default", [])
    final = [m for m in cfg_mods if m in available_modules]
    if not final:
        final = available_modules
    labels = await get_module_labels()
    out = [{"key": m, "label": labels.get(m, {"en": m})} for m in final]
    return {"modules": out}

@api.post("/quiz/submit")
async def quiz_submit(payload: QuizSubmit):
    sid = payload.session_id or f"sess_{uuid.uuid4().hex[:12]}"
    combo = await db.demo_flows.find_one({
        "business_type": payload.business_type,
        "product_category": payload.product_category,
        "modules": {"$all": payload.modules, "$size": len(payload.modules)},
        "status": "active"
    }, {"_id": 0})
    videos = []
    resolution = "fallback"
    flow_name = ""
    if combo:
        resolution = "combination"
        flow_name = combo["name"]
        for vid_id in combo.get("video_sequence", []):
            v = await db.module_videos.find_one({"id": vid_id, "published": True}, {"_id": 0})
            if v:
                videos.append(v)
    else:
        ordered = sorted(payload.modules, key=lambda m: WORKFLOW_ORDER.index(m) if m in WORKFLOW_ORDER else 999)
        for m in ordered:
            v = await db.module_videos.find_one({"module_key": m, "published": True}, {"_id": 0})
            if v:
                videos.append(v)

    await db.sessions.update_one({"session_id": sid}, {"$set": {
        "session_id": sid,
        "business_type": payload.business_type,
        "product_category": payload.product_category,
        "modules": payload.modules,
        "language": payload.language,
        "resolution": resolution,
        "flow_name": flow_name,
        "videos_played": [v["id"] for v in videos],
        "started_at": datetime.now(timezone.utc).isoformat()
    }}, upsert=True)
    return {"session_id": sid, "resolution": resolution, "flow_name": flow_name, "videos": videos}

# ========== Interaction Tracker ==========
@api.post("/sessions/event")
async def track_event(ev: EventIn):
    await db.events.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": ev.session_id,
        "event_type": ev.event_type,
        "payload": ev.payload or {},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"ok": True}

@api.post("/sessions/start")
async def session_start():
    sid = f"sess_{uuid.uuid4().hex[:12]}"
    await db.sessions.insert_one({
        "session_id": sid,
        "started_at": datetime.now(timezone.utc).isoformat()
    })
    return {"session_id": sid}

# ========== AI Chat — Cost-Optimized + Smart Clarification ==========
LANG_NAMES = {"en": "English", "hi": "Hindi", "gu": "Gujarati", "mr": "Marathi"}

def _parse_llm_json(raw: str) -> Dict[str, Any]:
    if not raw:
        return {}
    raw = raw.strip()
    if raw.startswith("```"):
        raw = _re.sub(r"^```(?:json)?\s*", "", raw)
        raw = _re.sub(r"\s*```$", "", raw)
    m = _re.search(r"\{[\s\S]*\}", raw)
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except Exception:
        return {}

# ------------------------------------------------------------------
# Keyword pre-filter: narrows 500 KB entries → top N before LLM call
# Saves ~85% of input tokens on every chat message
# ------------------------------------------------------------------
def _keyword_prefilter(question: str, kb_entries: List[Dict], top_n: int = 15) -> List[Dict]:
    q_tokens = set(w.lower() for w in _re.split(r'\W+', question) if len(w) >= 3)
    if not q_tokens:
        return kb_entries[:top_n]

    scored = []
    for e in kb_entries:
        score = 0
        kb_q_tokens = set(w.lower() for w in _re.split(r'\W+', e.get("question", "")) if len(w) >= 3)
        score += len(q_tokens & kb_q_tokens) * 2          # question overlap weighted 2x
        tag_tokens = set(t.lower() for t in (e.get("tags") or []))
        score += len(q_tokens & tag_tokens) * 3           # tag overlap weighted 3x
        ans_en = ((e.get("answers") or {}).get("en") or "").lower()
        for tok in q_tokens:
            if tok in ans_en:
                score += 1                                 # answer content overlap
        if score > 0:
            scored.append((score, e))

    scored.sort(key=lambda x: x[0], reverse=True)
    filtered = [e for _, e in scored[:top_n]]

    # Pad with extra entries if not enough scored results
    if len(filtered) < min(top_n, len(kb_entries)):
        seen_ids = {e["id"] for e in filtered}
        for e in kb_entries:
            if len(filtered) >= top_n:
                break
            if e["id"] not in seen_ids:
                filtered.append(e)
    return filtered

# ------------------------------------------------------------------
# Single merged LLM call: match + rephrase + clarify all in one shot
# For short/vague queries: surfaces real KB questions as clickable options
# For clear queries: answers directly in user's language
# Model: gpt-4o-mini (~20x cheaper than gpt-5.2, same quality for this)
# ------------------------------------------------------------------
# ------------------------------------------------------------------
# Intent pre-classifier — runs BEFORE KB search
# Catches: callback requests, executive requests, pricing, demo booking
# These should NEVER hit the KB — they go straight to executive CTA
# ------------------------------------------------------------------
def _detect_direct_intent(question: str) -> Optional[str]:
    """
    Returns an intent string if the query is clearly non-KB.
    Returns None if it should go through normal KB matching.
    """
    q = question.lower().strip()

    # Callback / call / contact / executive / talk to someone
    callback_signals = [
        "call back", "callback", "call me", "arrange a call", "schedule a call",
        "book a call", "contact me", "reach me", "call from your team",
        "talk with executive", "talk to executive", "speak with executive",
        "speak to someone", "talk to someone", "talk to a person",
        "connect me", "get in touch", "want to talk", "want to speak",
        "want a call", "need a call", "sales team", "your team",
        "executive", "sales person", "salesperson", "agent",
        "कॉल करें", "कॉल बैक", "बात करना", "एग्जीक्यूटिव",
        "ફોન કરો", "કૉલ બૅક", "વાત કરવી",
        "कॉल करा", "बोलायचे आहे",
    ]
    if any(sig in q for sig in callback_signals):
        return "executive_cta"

    # Pricing / cost / how much
    pricing_signals = [
        "price", "pricing", "cost", "how much", "fee", "charges", "plan",
        "subscription", "rate", "quote me", "quotation for me",
        "कीमत", "मूल्य", "कितना", "शुल्क",
        "ભાવ", "કેટલો", "ખર્ચ",
        "किंमत", "किती",
    ]
    if any(sig in q for sig in pricing_signals):
        return "pricing"

    return None


async def llm_match_and_answer(
    question: str,
    kb_entries: List[Dict],
    lang: str,
    is_short_query: bool = False,
    ai_config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    if not kb_entries:
        return {"status": "none"}

    lang_name = LANG_NAMES.get(lang, "English")

    kb_lines = []
    for e in kb_entries:
        tags = ", ".join(e.get("tags") or [])
        ans_en = ((e.get("answers") or {}).get("en") or
                  next(iter((e.get("answers") or {}).values()), ""))
        ans_snip = ans_en.replace("\n", " ").strip()
        if len(ans_snip) > 220:
            ans_snip = ans_snip[:220] + "…"
        kb_lines.append(
            f'- id: {e["id"]}\n  question: "{e["question"]}"\n  tags: [{tags}]\n  answer: "{ans_snip}"'
        )
    kb_block = "\n".join(kb_lines)

    short_query_rule = (
        "\nIMPORTANT — SHORT/VAGUE QUERY RULES:\n"
        "The user typed a very short or vague query (1-3 words). Do NOT guess intent and answer directly.\n"
        "Instead:\n"
        "1. Look through the KB entries and find up to 3 entries whose questions are RELATED to the user's topic.\n"
        "2. Return status='ambiguous' with those candidate_ids.\n"
        "3. The user will then click the actual KB question that matches what they meant.\n"
        "4. Only return status='match' if there is literally ONE possible interpretation and it is 100% crystal clear.\n"
        "5. If no KB entries are related at all, return status='none'.\n"
    ) if is_short_query else ""

    system_msg = (
        "You are the AI assistant for Biziverse, a business SaaS product for Indian SMBs.\n\n"
        "Your job: Given a user question and KB entries, return ONE JSON that does:\n\n"

        "STEP 1 — UNDERSTAND INTENT DEEPLY:\n"
        "  Before matching, ask yourself: What is the user ACTUALLY trying to do?\n"
        "  - Are they asking about a Biziverse FEATURE? → search KB\n"
        "  - Are they asking HOW TO DO something in Biziverse? → search KB\n"
        "  - Are they asking to TALK TO SOMEONE / CALL BACK / EXECUTIVE? → status='none' (not a KB question)\n"
        "  - Are they asking about PRICING / COST / PLANS? → status='none'\n"
        "  - Are they asking something COMPLETELY UNRELATED to the product? → status='none'\n\n"

        "STEP 2 — MATCH:\n"
        "  - Match on TOPIC and INTENT, not just shared keywords.\n"
        "  - 'salesperson' in KB about sales tracking ≠ 'talk to your salesperson' (that's executive CTA).\n"
        "  - If one KB entry's answer clearly covers the question → status='match'\n"
        "  - If 2-3 entries could plausibly match → status='ambiguous' with candidate_ids\n"
        "  - If no entry covers it → status='none'\n"
        f"{short_query_rule}\n"

        "STEP 3 — ANSWER (only when status='match'):\n"
        f"  - Write a clear, natural answer in {lang_name}.\n"
        "  - Structure it well: lead with the direct answer (Yes/No), then explain briefly.\n"
        "  - Use simple formatting if helpful: short sentences, one idea per line.\n"
        "  - STRICTLY stay within KB facts. Do NOT invent features, prices, or capabilities.\n"
        "  - 2 to 4 sentences max. No greetings, no markdown headers, no bullet overload.\n\n"

        "Output ONLY a JSON object. No prose, no code fences."
    )

    user_prompt = (
        f"USER QUESTION: {question}\n\n"
        f"KB ENTRIES:\n{kb_block}\n\n"
        "Respond with exactly this JSON (all keys required, empty string/array if unused):\n"
        '{"status": "match" | "ambiguous" | "none", '
        '"kb_id": "<matched entry id or empty>", '
        '"answer": "<clear well-structured answer in user language, or empty>", '
        '"candidate_ids": ["<id1>", "<id2>", "<id3>"], '
        '"clarify_question": "<clarifying question or empty>"}'
    )

    try:
        api_key = (ai_config or {}).get("api_key") or EMERGENT_LLM_KEY
        model_conf = (ai_config or {}).get("llm_model") or DEFAULT_AI_SETTINGS["llm_model"]
        provider = model_conf.get("provider", "openai")
        model_name = model_conf.get("model", "gpt-4o-mini")
        chat = LlmChat(
            api_key=api_key,
            session_id=f"kb-{uuid.uuid4().hex[:8]}",
            system_message=system_msg,
        ).with_model(provider, model_name)
        raw = await chat.send_message(UserMessage(text=user_prompt))
        data = _parse_llm_json(raw)
        if data.get("status") in ("match", "ambiguous", "none"):
            return data
    except Exception as e:
        logger.error(f"llm_match_and_answer failed: {e}")
    return {"status": "none"}


@api.post("/ai/chat")
async def ai_chat(payload: ChatIn):
    q = (payload.message or "").strip()
    if not q:
        raise HTTPException(400, "Empty message")
    q_lower = q.lower()

    settings = await get_main_settings()
    ai_config = settings.get("ai_settings", DEFAULT_AI_SETTINGS)

    # ── Quick greeting handler — zero LLM cost ──
    greetings = {"hi", "hello", "hey", "namaste", "hii", "helo", "hola", "नमस्ते", "नमस्कार"}
    if q_lower in greetings or len(q_lower) <= 2:
        return {
            "answer": ai_config.get("greeting", {}).get(payload.language,
                                                         DEFAULT_AI_SETTINGS["greeting"]["en"]),
            "from_kb": False,
            "no_answer": False,
            "video_url": None
        }

    # ── Intent pre-classifier — catches executive/callback/pricing BEFORE KB ──
    direct_intent = _detect_direct_intent(q)

    if direct_intent == "executive_cta":
        return {
            "answer": ai_config.get("executive_response", {}).get(payload.language,
                                                                    DEFAULT_AI_SETTINGS["executive_response"]["en"]),
            "from_kb": False,
            "no_answer": bool(ai_config.get("show_exec_cta_on_direct_intent", True)),
            "video_url": None,
        }

    if direct_intent == "pricing":
        return {
            "answer": ai_config.get("pricing_response", {}).get(payload.language,
                                                                   DEFAULT_AI_SETTINGS["pricing_response"]["en"]),
            "from_kb": False,
            "no_answer": bool(ai_config.get("show_exec_cta_on_direct_intent", True)),
            "video_url": None,
        }

    # ── Load KB from cache ──
    kb_entries = await get_kb_entries_cached()
    if not kb_entries:
        return await _log_and_fallback(payload, q)

    # ── Short/vague query detection ──
    word_count = len(q.split())
    is_short_query = word_count <= 3
    top_n = 20 if is_short_query else 15

    # ── Keyword pre-filter → top N candidates only ──
    candidates = _keyword_prefilter(q, kb_entries, top_n=top_n)

    # ── Single LLM call: understand + match + answer ──
    result = await llm_match_and_answer(q, candidates, payload.language, is_short_query, ai_config)

    by_id = {e["id"]: e for e in kb_entries}

    # ── Case 1: Clear match ──
    if result.get("status") == "match":
        kb_id = result.get("kb_id", "")
        e = by_id.get(kb_id)
        if e:
            answer = result.get("answer", "").strip()
            if not answer:
                answer = ((e.get("answers") or {}).get(payload.language)
                          or (e.get("answers") or {}).get("en", ""))
            return {
                "answer": answer,
                "from_kb": True,
                "no_answer": False,
                "kb_id": e["id"],
                "kb_question": e.get("question"),
                "video_url": e.get("video_url"),
                "video_start": e.get("video_start"),
                "video_end": e.get("video_end"),
            }

    # ── Case 2: Ambiguous — show real KB questions as options ──
    if result.get("status") == "ambiguous":
        cand_ids = result.get("candidate_ids") or []
        ambig_candidates = [by_id[c] for c in cand_ids if c in by_id][:3]

        if ambig_candidates:
            clarify_intro = {
                "en": "Did you mean one of these?",
                "hi": "क्या आप इनमें से कोई एक पूछ रहे हैं?",
                "gu": "શું તमे आमाथी कंई पूछवा मांगो छो?",
                "mr": "तुम्हाला यापैकी काही विचारायचे आहे का?",
            }.get(payload.language, "Did you mean one of these?")

            return {
                "answer": clarify_intro,
                "clarify": True,
                "candidates": [
                    {"id": c["id"], "question": c["question"]}
                    for c in ambig_candidates
                ],
                "from_kb": False,
                "no_answer": False,
                "video_url": None,
            }

        # Ambiguous but no valid candidates found
        elaborate = {
            "en": "Could you describe what you're looking for in a bit more detail?",
            "hi": "क्या आप थोड़ा और विस्तार से बता सकते हैं?",
            "gu": "શું तमे थोडी वधु विगत आपी शको?",
            "mr": "तुम्ही थोडे अधिक तपशील देऊ शकता का?",
        }.get(payload.language, "Could you describe what you're looking for in a bit more detail?")

        return {
            "answer": elaborate,
            "clarify": True,
            "candidates": [],
            "from_kb": False,
            "no_answer": bool(ai_config.get("show_exec_cta_on_ambiguous", False)),
            "video_url": None,
        }

    # ── Case 3: No match — log + executive CTA ──
    return await _log_and_fallback(payload, q, ai_config)

async def _log_and_fallback(payload: ChatIn, q: str, ai_config: Dict[str, Any]):
    """Log unanswered question for admin review and return executive CTA."""
    await db.unanswered_questions.insert_one({
        "id": f"uq_{uuid.uuid4().hex[:10]}",
        "session_id": payload.session_id,
        "question": q,
        "language": payload.language,
        "business_type": payload.business_type,
        "product_category": payload.product_category,
        "modules": payload.modules or [],
        "resolved": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    fallback = ai_config.get("fallback_response", {})
    return {
        "answer": fallback.get(payload.language, DEFAULT_AI_SETTINGS["fallback_response"]["en"]),
        "from_kb": False,
        "no_answer": bool(ai_config.get("show_exec_cta_on_no_answer", True)),
        "video_url": None
    }

# ========== Signup (Mocked OTP + Razorpay) ==========
@api.post("/signup/otp/send")
async def otp_send(payload: OTPSendIn):
    code = "".join(random.choices(string.digits, k=6))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    await db.otps.update_one({"mobile": payload.mobile},
                             {"$set": {"mobile": payload.mobile, "otp": code,
                                       "expires_at": expires_at.isoformat(),
                                       "used": False}},
                             upsert=True)
    logger.info(f"[MOCK OTP] {payload.mobile} -> {code}")
    return {"ok": True, "mock_otp": code}

@api.post("/signup/otp/verify")
async def otp_verify(payload: OTPVerifyIn):
    rec = await db.otps.find_one({"mobile": payload.mobile}, {"_id": 0})
    if not rec or rec.get("used"):
        raise HTTPException(400, "OTP not requested or already used")
    expires_at = rec["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(400, "OTP expired")
    if rec["otp"] != payload.otp:
        raise HTTPException(400, "Invalid OTP")
    await db.otps.update_one({"mobile": payload.mobile}, {"$set": {"used": True}})
    signup_id = f"signup_{uuid.uuid4().hex[:10]}"
    await db.signups.insert_one({
        "signup_id": signup_id,
        "mobile": payload.mobile,
        "session_id": payload.session_id,
        "verified_at": datetime.now(timezone.utc).isoformat()
    })
    return {"ok": True, "signup_id": signup_id}

@api.post("/signup/payment")
async def payment(payload: PaymentIn):
    plan_amount = 99900 if payload.plan == "monthly" else 999900
    order_id = f"order_mock_{uuid.uuid4().hex[:10]}"
    await db.payments.insert_one({
        "order_id": order_id, "mobile": payload.mobile, "plan": payload.plan,
        "amount": plan_amount, "status": "success",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"ok": True, "order_id": order_id, "amount": plan_amount, "status": "success", "mocked": True}

# ========== Biziverse CRM Lead Push ==========

BIZIVERSE_API_KEY = os.environ.get("BIZIVERSE_API_KEY", "0006-BE252952-CF86-4E97-9E7A-7E2E6113AFE7-8055")
BIZIVERSE_API_URL = "https://biziverse.com/PremiumAPI.asmx/setAPI"

@api.post("/callback/request")
async def callback_request(payload: CallbackRequestIn):
    """
    Called when user requests a callback from the demo.
    1. Saves to MongoDB for admin analytics
    2. Pushes a lead to Biziverse CRM with full demo context
    """

    # ── Validate phone ──
    phone = payload.phone.strip().replace(" ", "")
    phone = phone.replace("+91", "").replace("-", "")
    phone = ''.join(filter(str.isdigit, phone))
    if phone.startswith("91") and len(phone) == 12:
        phone = phone[2:]
    if len(phone) != 10:
        raise HTTPException(400, "Invalid phone number")

    # ── Save to MongoDB ──
    cb_id = f"cb_{uuid.uuid4().hex[:10]}"
    await db.callback_requests.insert_one({
        "id": cb_id,
        "phone": phone,
        "callback_time": payload.callback_time,
        "session_id": payload.session_id,
        "business_type": payload.business_type,
        "product_category": payload.product_category,
        "modules_watched": payload.modules_watched or [],
        "questions_asked": payload.questions_asked or [],
        "language": payload.language,
        "human_now": bool(payload.human_now),
        "voice_requested": bool(payload.voice_requested),
        "request_note": payload.request_note or "",
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    live_lead_id = f"ll_{uuid.uuid4().hex[:10]}"
    await db.live_leads.insert_one({
        "id": live_lead_id,
        "callback_request_id": cb_id,
        "phone": phone,
        "session_id": payload.session_id,
        "business_type": payload.business_type,
        "product_category": payload.product_category,
        "modules_watched": payload.modules_watched or [],
        "questions_asked": payload.questions_asked or [],
        "language": payload.language,
        "human_now": bool(payload.human_now),
        "voice_requested": bool(payload.voice_requested),
        "request_note": payload.request_note or "",
        "status": "pending",
        "assigned_to": None,
        "industry": None,
        "sector": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    })

    # ── Build the "needs" string with full demo context ──
    needs_parts = []

    # Preferred callback time
    try:
        dt = datetime.fromisoformat(payload.callback_time.replace("Z", "+00:00"))
        needs_parts.append(f"Callback requested: {dt.strftime('%d %b %Y at %I:%M %p')}")
    except Exception:
        needs_parts.append(f"Callback time: {payload.callback_time}")

    # Business context
    if payload.business_type:
        needs_parts.append(f"Business type: {payload.business_type}")
    if payload.product_category:
        needs_parts.append(f"Product category: {payload.product_category}")

    # Modules they watched
    if payload.modules_watched:
        needs_parts.append(f"Modules watched: {', '.join(payload.modules_watched)}")

    # Questions they asked in AI chat
    if payload.questions_asked:
        needs_parts.append(f"Questions asked: {' | '.join(payload.questions_asked[:10])}")

    needs_str = " | ".join(needs_parts)

    # ── Build lead payload for Biziverse CRM ──
    lead_data = {
        "companyName": f"Demo Lead - {phone}",
        "title": "",
        "firstName": "Demo",
        "lastName": "Lead",
        "email": "",
        "mobile": phone,
        "designation": "",
        "city": "",
        "state": "",
        "needs": needs_str,
        "source": "Biziverse Smart Demo"
    }

    api_params = json.dumps([{
        "moduleID": 25,
        "actionType": "setLead",
        "data": json.dumps([lead_data])
    }])

    # ── Push to Biziverse CRM ──
    crm_status = "unknown"
    try:
        r = requests.post(
            BIZIVERSE_API_URL,
            data={"apiKey": BIZIVERSE_API_KEY, "apiParams": api_params},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
            verify=False
        )
        txt = r.text
        logger.info(f"Biziverse CRM response for {phone}: {txt}")

        if "-1" in txt or "Lead saved" in txt:
            crm_status = "created"
        elif "305" in txt:
            crm_status = "duplicate"   # lead already exists — that's fine
        elif "200" in txt:
            crm_status = "invalid_api_key"
        elif "201" in txt:
            crm_status = "data_missing"
        else:
            crm_status = f"unknown_response: {txt[:100]}"

    except Exception as e:
        logger.error(f"Biziverse CRM push failed for {phone}: {e}")
        crm_status = f"error: {str(e)}"

    # ── Update MongoDB with CRM result ──
    await db.callback_requests.update_one(
        {"id": cb_id},
        {"$set": {"crm_status": crm_status, "crm_pushed_at": datetime.now(timezone.utc).isoformat()}}
    )

    return {
        "ok": True,
        "callback_id": cb_id,
        "crm_status": crm_status,
        "live_lead_id": live_lead_id
    }


@api.post("/live-leads/{lead_id}/messages")
async def add_live_lead_message(lead_id: str, payload: LiveLeadMessageIn):
    if payload.role not in {"user", "agent"}:
        raise HTTPException(400, "Invalid role")
    if payload.type not in {"text", "audio"}:
        raise HTTPException(400, "Invalid message type")
    if payload.type == "text" and not payload.text:
        raise HTTPException(400, "Text is required for text messages")
    if payload.type == "audio" and not payload.audio_data:
        raise HTTPException(400, "Audio data is required for audio messages")
    msg_id = f"llm_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": msg_id,
        "live_lead_id": lead_id,
        "role": payload.role,
        "type": payload.type,
        "text": payload.text or "",
        "audio_data": payload.audio_data or None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.live_lead_messages.insert_one(doc)
    await db.live_leads.update_one({"id": lead_id}, {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}})
    # Broadcast real-time — route to the OTHER party only (no echo back to sender)
    try:
        push = {
            "type": "new_message",
            "message": {
                "id": msg_id,
                "live_lead_id": lead_id,
                "role": doc["role"],
                "type": doc["type"],
                "text": doc["text"],
                "created_at": doc["created_at"],
            }
        }
        if payload.role == "user":
            # User sent → notify agent's lead channel
            await ws_manager.broadcast(f"lead:{lead_id}", push)
        else:
            # Agent sent → notify user's session channel
            lead_doc = await db.live_leads.find_one({"id": lead_id}, {"_id": 0})
            if lead_doc and lead_doc.get("session_id"):
                await ws_manager.broadcast(f"session:{lead_doc['session_id']}", push)
    except Exception:
        logger.exception("Failed to broadcast live lead message")

    return {"ok": True, "message_id": msg_id}

@api.get("/live-leads/{lead_id}/messages")
async def list_live_lead_messages(lead_id: str):
    items = await db.live_lead_messages.find({"live_lead_id": lead_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return items

@api.get("/live-leads/{lead_id}")
async def get_live_lead(lead_id: str):
    lead = await db.live_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Live lead not found")
    return lead


@api.get("/live-leads/session/{session_id}")
async def get_live_lead_by_session(session_id: str):
    """Return the live lead for a given demo `session_id` if one exists."""
    lead = await db.live_leads.find_one({"session_id": session_id}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Live lead not found for session")
    return lead

@api.get("/admin/live-leads")
async def admin_list_live_leads(user=Depends(admin_dep)):
    items = await db.live_leads.find({}, {"_id": 0}).sort([("status", 1), ("created_at", -1)]).to_list(500)
    return items

@api.post("/admin/live-leads/{lead_id}/assign")
async def assign_live_lead(lead_id: str, user=Depends(admin_dep)):
    lead = await db.live_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(404, "Live lead not found")
  # Mark the lead as active/live and record assignment
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.live_leads.update_one({"id": lead_id}, {
        "$set": {
            "assigned_to": user["user_id"],
            "status": "active",
            "in_session_at": now_iso,
            "updated_at": now_iso
        }
    })

    # Insert a system message indicating the agent joined
    try:
        msg_id = f"llm_{uuid.uuid4().hex[:10]}"
        await db.live_lead_messages.insert_one({
            "id": msg_id,
            "live_lead_id": lead_id,
            "role": "system",
            "type": "text",
            "text": f"Agent {user.get('name', user.get('user_id'))} has joined the chat.",
            "created_at": now_iso,
        })
    except Exception:
        logger.exception("Failed to insert agent-joined message")

    # Return updated lead document so frontend can open the detail view
    updated = await db.live_leads.find_one({"id": lead_id}, {"_id": 0})
    # Broadcast agent joined to session and lead channels
    try:
        payload = {"type": "agent_joined", "agent": {"user_id": user["user_id"], "name": user.get("name")}, "lead": {"id": lead_id}}
        await ws_manager.broadcast(f"lead:{lead_id}", payload)
        if updated and updated.get("session_id"):
            await ws_manager.broadcast(f"session:{updated.get('session_id')}", payload)
    except Exception:
        logger.exception("Failed to broadcast agent_joined")
    return {"ok": True, "lead": updated}


@api.post("/admin/kb/suggest")
async def admin_kb_suggest(payload: Dict[str, Any], user=Depends(admin_dep)):
    """Return KB candidate entries for an agent given a question.

    Expects JSON: {"question": "...", "top_n": 5}
    """
    q = (payload.get("question") or "").strip()
    if not q:
        raise HTTPException(400, "Question is required")
    top_n = int(payload.get("top_n", 5))
    kb_entries = await get_kb_entries_cached()
    if not kb_entries:
        return {"candidates": []}
    candidates = _keyword_prefilter(q, kb_entries, top_n=top_n)
    # Trim and present lightweight fields
    out = []
    for e in candidates:
        ans = ((e.get("answers") or {}).get("en") or "").strip()
        snippet = ans[:300] + ("…" if len(ans) > 300 else "")
        out.append({"id": e["id"], "question": e.get("question"), "snippet": snippet})
    return {"candidates": out}


@api.websocket("/ws/live/{channel}")
async def ws_live(channel: str, websocket: WebSocket):
    """WebSocket endpoint. `channel` should be of form `lead:<lead_id>` or `session:<session_id>`.
    No auth required — REST endpoints handle all write-auth. WS is push-only.
    """
    is_lead = channel.startswith("lead:")
    is_session = channel.startswith("session:")

    await ws_manager.connect(channel, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue

            try:
                obj = json.loads(data)
            except Exception:
                obj = None

            # Forward typing/presence events between session<->lead channels
            if isinstance(obj, dict) and obj.get("type") in {"typing", "presence"}:
                typ = obj.get("type")
                payload_data = obj.get("payload", {})
                if is_session:
                    sess_id = channel.split(":", 1)[1]
                    lead = await db.live_leads.find_one({"session_id": sess_id}, {"_id": 0})
                    if lead:
                        await ws_manager.broadcast(f"lead:{lead['id']}", {"type": typ, "from": "user", "payload": payload_data})
                elif is_lead:
                    lead_id = channel.split(":", 1)[1]
                    lead = await db.live_leads.find_one({"id": lead_id}, {"_id": 0})
                    if lead and lead.get("session_id"):
                        await ws_manager.broadcast(f"session:{lead['session_id']}", {"type": typ, "from": "agent", "payload": payload_data})
                continue

    except WebSocketDisconnect:
        ws_manager.disconnect(channel, websocket)
    except Exception:
        try:
            ws_manager.disconnect(channel, websocket)
        except Exception:
            pass

@api.put("/admin/live-leads/{lead_id}")
async def update_live_lead(lead_id: str, payload: LiveLeadUpdateIn, user=Depends(admin_dep)):
    update_doc = {}
    if payload.assigned_to is not None:
        update_doc["assigned_to"] = payload.assigned_to
    if payload.status is not None:
        update_doc["status"] = payload.status
    if payload.industry is not None:
        update_doc["industry"] = payload.industry
    if payload.sector is not None:
        update_doc["sector"] = payload.sector
    if update_doc:
        update_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.live_leads.update_one({"id": lead_id}, {"$set": update_doc})
    return await db.live_leads.find_one({"id": lead_id}, {"_id": 0})

@api.post("/auth/login")
async def auth_login(payload: AuthLoginIn, response: Response):
    user = await db.users.find_one({"user_id": payload.user_id})
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Invalid credentials")
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    session_token = uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    response.set_cookie("session_token", session_token, max_age=7*24*3600,
                        httponly=True, secure=True, samesite="none", path="/")
    return {"user_id": user["user_id"], "email": user.get("email"), "name": user.get("name"), "picture": user.get("picture"), "role": user.get("role")}

@api.get("/admin/users")
async def admin_list_users(user=Depends(admin_dep)):
    items = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return items

@api.post("/admin/users")
async def admin_create_user(payload: AdminUserIn, user=Depends(admin_dep)):
    if not payload.password:
        raise HTTPException(400, "Password is required")
    existing = await db.users.find_one({"user_id": payload.user_id})
    if existing:
        raise HTTPException(400, "User already exists")
    doc = {
        "user_id": payload.user_id,
        "email": payload.email,
        "name": payload.name or payload.user_id,
        "role": payload.role or "agent",
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash", None)
    return doc

@api.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, payload: AdminUserUpdateIn, user=Depends(admin_dep)):
    update_doc = {}
    if payload.email is not None:
        update_doc["email"] = payload.email
    if payload.name is not None:
        update_doc["name"] = payload.name
    if payload.role is not None:
        update_doc["role"] = payload.role
    if payload.password is not None:
        update_doc["password_hash"] = hash_password(payload.password)
    if update_doc:
        await db.users.update_one({"user_id": user_id}, {"$set": update_doc})
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user_doc:
        raise HTTPException(404, "User not found")
    return user_doc

@api.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, user=Depends(admin_dep)):
    await db.users.delete_one({"user_id": user_id})
    return {"ok": True}

@api.get("/admin/callbacks")
async def list_callbacks(user=Depends(admin_dep)):
    """Admin view of all callback requests."""
    items = await db.callback_requests.find({}, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    return items

# ========== Agent Presence ==========
@api.get("/presence")
async def get_presence_public():
    """Public: returns whether any agent is currently online."""
    count = await db.agent_presence.count_documents({"online": True})
    return {"any_online": count > 0, "online_count": count}

@api.get("/admin/presence")
async def get_my_presence(user=Depends(admin_dep)):
    doc = await db.agent_presence.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"online": bool(doc and doc.get("online")), "user_id": user["user_id"]}

@api.put("/admin/presence")
async def set_my_presence(payload: Dict[str, Any], user=Depends(admin_dep)):
    online = bool(payload.get("online", True))
    await db.agent_presence.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"online": online, "user_id": user["user_id"], "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"ok": True, "online": online}

# ========== Settings ==========
@api.get("/settings")
async def get_settings_public():
    settings = await get_main_settings()
    return {
        "show_executive_cta": settings.get("show_executive_cta", True),
        "executive_phone": settings.get("executive_phone", ""),
        "ai_settings": settings.get("ai_settings", DEFAULT_AI_SETTINGS)
    }

@api.get("/admin/settings")
async def get_settings(user=Depends(admin_dep)):
    return await get_main_settings()

@api.put("/admin/settings")
async def set_settings(payload: Dict[str, Any], user=Depends(admin_dep)):
    await db.settings.update_one({"_id": "main"}, {"$set": payload}, upsert=True)
    return await get_main_settings()

# ========== Unanswered Questions ==========
@api.get("/admin/unanswered")
async def list_unanswered(user=Depends(admin_dep)):
    items = await db.unanswered_questions.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)
    return items

@api.post("/admin/unanswered/{qid}/resolve")
async def resolve_unanswered(qid: str, user=Depends(admin_dep)):
    await db.unanswered_questions.update_one({"id": qid}, {"$set": {"resolved": True, "resolved_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True}

@api.delete("/admin/unanswered/{qid}")
async def delete_unanswered(qid: str, user=Depends(admin_dep)):
    await db.unanswered_questions.delete_one({"id": qid})
    return {"ok": True}

# ========== Admin: Videos & Markers ==========
@api.get("/admin/videos2")
async def list_videos2(user=Depends(admin_dep)):
    items = await db.module_videos.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api.post("/admin/videos")
async def create_video(payload: ModuleVideoIn, user=Depends(admin_dep)):
    vid = f"vid_{uuid.uuid4().hex[:10]}"
    doc = payload.model_dump()
    doc.update({"id": vid, "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "created_by": user["email"]})
    await db.module_videos.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/admin/videos/{vid}")
async def update_video(vid: str, payload: ModuleVideoIn, user=Depends(admin_dep)):
    doc = payload.model_dump()
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.module_videos.update_one({"id": vid}, {"$set": doc})
    if not res.matched_count:
        raise HTTPException(404, "Not found")
    return await db.module_videos.find_one({"id": vid}, {"_id": 0})

@api.delete("/admin/videos/{vid}")
async def delete_video(vid: str, user=Depends(admin_dep)):
    await db.module_videos.delete_one({"id": vid})
    return {"ok": True}

@api.post("/admin/upload")
async def upload_file(file: UploadFile = File(...), user=Depends(admin_dep)):
    ext = (file.filename or "bin").split(".")[-1].lower()
    path = f"{APP_NAME}/videos/{user['user_id']}/{uuid.uuid4().hex}.{ext}"
    data = await file.read()
    if len(data) > 200 * 1024 * 1024:
        raise HTTPException(413, "File too large (max 200MB)")
    result = put_object(path, data, file.content_type or "video/mp4")
    return {"storage_path": result["path"], "size": result["size"]}

@api.get("/files/{path:path}")
async def get_file(path: str):
    try:
        data, ct = get_object(path)
        return Response(content=data, media_type=ct)
    except Exception as e:
        raise HTTPException(404, "File not found")

# ========== Admin: Flows / Combinations ==========
@api.get("/admin/flows")
async def list_flows(user=Depends(admin_dep)):
    items = await db.demo_flows.find({}, {"_id": 0}).to_list(500)
    return items

@api.post("/admin/flows")
async def create_flow(payload: FlowIn, user=Depends(admin_dep)):
    existing = await db.demo_flows.find_one({
        "business_type": payload.business_type,
        "product_category": payload.product_category,
        "modules": {"$all": payload.modules, "$size": len(payload.modules)}
    })
    if existing:
        raise HTTPException(400, "A flow with the same combination already exists")
    fid = f"flow_{uuid.uuid4().hex[:10]}"
    doc = payload.model_dump()
    doc.update({"id": fid, "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()})
    await db.demo_flows.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/admin/flows/{fid}")
async def update_flow(fid: str, payload: FlowIn, user=Depends(admin_dep)):
    doc = payload.model_dump()
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.demo_flows.update_one({"id": fid}, {"$set": doc})
    return await db.demo_flows.find_one({"id": fid}, {"_id": 0})

@api.delete("/admin/flows/{fid}")
async def delete_flow(fid: str, user=Depends(admin_dep)):
    await db.demo_flows.delete_one({"id": fid})
    return {"ok": True}

# ========== Admin: KB ==========
@api.get("/admin/kb")
async def list_kb(user=Depends(admin_dep)):
    return await db.kb_entries.find({}, {"_id": 0}).to_list(1000)

@api.post("/admin/kb")
async def create_kb(payload: KBEntryIn, user=Depends(admin_dep)):
    invalidate_kb_cache()
    kid = f"kb_{uuid.uuid4().hex[:10]}"
    doc = payload.model_dump()
    doc.update({"id": kid, "created_at": datetime.now(timezone.utc).isoformat()})
    await db.kb_entries.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/admin/kb/{kid}")
async def update_kb(kid: str, payload: KBEntryIn, user=Depends(admin_dep)):
    invalidate_kb_cache()
    await db.kb_entries.update_one({"id": kid}, {"$set": payload.model_dump()})
    return await db.kb_entries.find_one({"id": kid}, {"_id": 0})

@api.delete("/admin/kb/{kid}")
async def delete_kb(kid: str, user=Depends(admin_dep)):
    invalidate_kb_cache()
    await db.kb_entries.delete_one({"id": kid})
    return {"ok": True}

# ========== Admin: Bulk KB Upload ==========
@api.post("/admin/kb/bulk-upload")
async def bulk_kb_upload(
    file: UploadFile = File(...),
    on_duplicate: str = Query("overwrite"),
    user=Depends(admin_dep)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only .csv files are supported")

    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    # Auto-detect tab vs comma delimiter
    sample = text[:2000]
    delimiter = "\t" if sample.count("\t") > sample.count(",") else ","
    reader = csv.DictReader(_io.StringIO(text), delimiter=delimiter)

    required = {"question", "answer_en"}
    if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
        raise HTTPException(
            400,
            f"CSV must have at minimum: {required}. Found: {reader.fieldnames}"
        )

    answer_cols = [col for col in (reader.fieldnames or []) if col.startswith("answer_")]
    lang_codes = [col.replace("answer_", "") for col in answer_cols]

    inserted = 0
    skipped = 0
    overwritten = 0
    errors = []

    for i, row in enumerate(reader, start=2):
        question = (row.get("question") or "").strip()
        answer_en = (row.get("answer_en") or "").strip()

        if not question or not answer_en:
            errors.append(f"Row {i}: 'question' and 'answer_en' are required — skipped")
            continue

        answers: Dict[str, str] = {}
        for lang in lang_codes:
            val = (row.get(f"answer_{lang}") or "").strip()
            if val:
                answers[lang] = val

        tags_raw = (row.get("tags") or "").strip()
        tags = [t.strip().lower() for t in tags_raw.split(",") if t.strip()] if tags_raw else []

        video_url = (row.get("video_url") or "").strip() or None
        video_start = (row.get("video_start") or "").strip()
        video_end = (row.get("video_end") or "").strip()
        try:
            video_start = float(video_start) if video_start else None
        except ValueError:
            video_start = None
        try:
            video_end = float(video_end) if video_end else None
        except ValueError:
            video_end = None

        existing = await db.kb_entries.find_one(
            {"question": question}, {"_id": 0, "id": 1}
        )

        if existing:
            if on_duplicate == "skip":
                skipped += 1
                continue
            else:  # overwrite
                await db.kb_entries.update_one(
                    {"question": question},
                    {"$set": {
                        "answers": answers,
                        "tags": tags,
                        "video_url": video_url,
                        "video_start": video_start,
                        "video_end": video_end,
                        "active": True,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                overwritten += 1
                continue

        await db.kb_entries.insert_one({
            "id": f"kb_{uuid.uuid4().hex[:10]}",
            "question": question,
            "answers": answers,
            "tags": tags,
            "video_url": video_url,
            "video_start": video_start,
            "video_end": video_end,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        inserted += 1

    invalidate_kb_cache()

    return {
        "ok": True,
        "inserted": inserted,
        "skipped": skipped,
        "overwritten": overwritten,
        "errors": errors,
        "languages_detected": lang_codes
    }


@api.get("/admin/kb/template")
async def kb_csv_template(user=Depends(admin_dep)):
    """Download a CSV template with columns for every configured language."""
    languages = await get_languages_list()
    lang_answer_cols = [f"answer_{l['code']}" for l in languages]
    all_cols = ["question"] + lang_answer_cols + ["tags", "video_url", "video_start", "video_end"]

    example_row = {
        "question": "Does Biziverse support <feature>?",
        "tags": "tag1,tag2",
        "video_url": "",
        "video_start": "",
        "video_end": ""
    }
    for l in languages:
        example_row[f"answer_{l['code']}"] = (
            "Yes — this feature is supported." if l["code"] == "en"
            else f"Answer in {l['label']} (optional)"
        )

    output = _io.StringIO()
    writer = csv.DictWriter(output, fieldnames=all_cols, extrasaction="ignore")
    writer.writeheader()
    writer.writerow(example_row)

    return Response(
        content=output.getvalue().encode("utf-8-sig"),  # BOM for Excel compatibility
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=kb_template.csv"}
    )

# ========== Admin: Quiz Options ==========
@api.get("/admin/quiz-options")
async def get_quiz_options(user=Depends(admin_dep)):
    cfg = await db.quiz_config.find_one({"_id": "main"}) or DEFAULT_QUIZ
    cfg.pop("_id", None)
    return cfg

@api.put("/admin/quiz-options")
async def set_quiz_options(payload: QuizOptionsIn, user=Depends(admin_dep)):
    doc = payload.model_dump()
    await db.quiz_config.update_one({"_id": "main"}, {"$set": doc}, upsert=True)
    return doc

# ========== Module Labels (public + admin) ==========
@api.get("/module-labels")
async def public_module_labels():
    labels = await get_module_labels()
    return {"labels": labels}

@api.get("/admin/module-labels")
async def admin_get_module_labels(user=Depends(admin_dep)):
    labels = await get_module_labels()
    return {"labels": labels}

@api.put("/admin/module-labels")
async def admin_set_module_labels(payload: Dict[str, Any], user=Depends(admin_dep)):
    global _module_labels_cache
    _module_labels_cache = None  # invalidate cache
    labels = payload.get("labels") or {}
    if not isinstance(labels, dict):
        raise HTTPException(400, "Body must be {'labels': {module_key: {lang: text}}}")
    await db.module_labels.update_one({"_id": "main"}, {"$set": {"labels": labels}}, upsert=True)
    return {"labels": (await get_module_labels())}

# ========== Languages (public + admin) ==========
async def get_languages_list() -> List[Dict[str, str]]:
    doc = await db.settings.find_one({"_id": "main"})
    langs = (doc or {}).get("languages")
    if isinstance(langs, list) and langs:
        return langs
    return DEFAULT_LANGUAGES

@api.get("/languages")
async def public_languages():
    return {"languages": await get_languages_list()}

@api.put("/admin/languages")
async def admin_set_languages(payload: Dict[str, Any], user=Depends(admin_dep)):
    langs = payload.get("languages") or []
    if not isinstance(langs, list):
        raise HTTPException(400, "Body must be {'languages': [{code, label, native}, ...]}")
    cleaned = []
    seen = set()
    for l in langs:
        code = (l.get("code") or "").strip().lower()
        if not code or code in seen:
            continue
        seen.add(code)
        cleaned.append({
            "code": code,
            "label": (l.get("label") or code.upper()).strip(),
            "native": (l.get("native") or l.get("label") or code.upper()).strip(),
        })
    if not cleaned:
        raise HTTPException(400, "At least one valid language required")
    await db.settings.update_one({"_id": "main"}, {"$set": {"languages": cleaned}}, upsert=True)
    return {"languages": cleaned}

# ========== Admin: Coverage ==========
@api.get("/admin/coverage")
async def coverage(user=Depends(admin_dep)):
    cfg = await db.quiz_config.find_one({"_id": "main"}, {"_id": 0}) or DEFAULT_QUIZ
    pub_videos = await db.module_videos.find({"published": True}, {"_id": 0}).to_list(1000)
    pub_modules = {v["module_key"] for v in pub_videos}
    flows = await db.demo_flows.find({"status": "active"}, {"_id": 0}).to_list(500)
    rows = []
    for bt in cfg["business_types"]:
        bt_key = bt["key"]
        for pc in cfg["product_categories"].get(bt_key, []):
            pc_key = pc["key"]
            mods_for_seg = cfg.get("modules", {}).get(f"{bt_key}|{pc_key}") or cfg.get("modules", {}).get("_default", [])
            avail = [m for m in mods_for_seg if m in pub_modules]
            seg_flows = [f for f in flows if f["business_type"] == bt_key and f["product_category"] == pc_key]
            status = "red"
            if seg_flows:
                status = "green"
            elif avail:
                status = "yellow"
            rows.append({
                "business_type": bt_key, "product_category": pc_key,
                "available_modules": avail, "flows_count": len(seg_flows),
                "status": status
            })
    return {"rows": rows}

# ========== Admin: Analytics ==========
@api.get("/admin/analytics/funnel")
async def funnel(user=Depends(admin_dep)):
    sessions_total = await db.sessions.count_documents({})
    quiz_done = await db.sessions.count_documents({"business_type": {"$exists": True}})
    demo_started = await db.events.distinct("session_id", {"event_type": "demo_started"})
    conversion_views = await db.events.distinct("session_id", {"event_type": "demo_ended"})
    signup_init = await db.events.distinct("session_id", {"event_type": "offers_selected"})

    funnel_data = [
        {"stage": "Landing", "count": sessions_total},
        {"stage": "Quiz Completed", "count": quiz_done},
        {"stage": "Demo Started", "count": len(demo_started)},
        {"stage": "Demo Ended", "count": len(conversion_views)},
        {"stage": "Offers Selected", "count": len(signup_init)},
        {"stage": "Callbacks Scheduled", "count": await db.events.count_documents({"event_type": "callback_requested"})},
    ]
    pipeline = [{"$group": {"_id": {"bt": "$business_type", "pc": "$product_category"}, "count": {"$sum": 1}}},
                {"$sort": {"count": -1}}, {"$limit": 10}]
    pop = await db.sessions.aggregate(pipeline).to_list(10)
    popular = [{"business_type": p["_id"]["bt"], "product_category": p["_id"]["pc"], "count": p["count"]} for p in pop if p["_id"]["bt"]]
    return {"funnel": funnel_data, "popular_flows": popular}

@api.get("/admin/analytics/sessions")
async def sessions_list(user=Depends(admin_dep)):
    items = await db.sessions.find({}, {"_id": 0}).sort("started_at", -1).limit(100).to_list(100)
    return items

@api.get("/admin/analytics/sessions/{sid}")
async def session_detail(sid: str, user=Depends(admin_dep)):
    s = await db.sessions.find_one({"session_id": sid}, {"_id": 0})
    events = await db.events.find({"session_id": sid}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return {"session": s, "events": events}

# ========== Seed ==========
@api.post("/seed")
async def seed_data():
    """Seed default demo data so app works out-of-the-box."""
    existing = await db.module_videos.count_documents({})
    if existing > 0:
        return {"ok": True, "already_seeded": True}

    seed_videos = [
        {"module_key": "crm", "title": "CRM — Leads Management",
         "video_url": "https://www.youtube.com/embed/ch3VGEvq71U"},
        {"module_key": "quotes", "title": "Quotes Management",
         "video_url": "https://www.youtube.com/embed/NzV7te7hlvQ"},
    ]
    for sv in seed_videos:
        vid = f"vid_{uuid.uuid4().hex[:10]}"
        markers = [
            {"id": str(uuid.uuid4()), "timestamp": 5.0, "pause_duration": 4,
             "highlight": {"x": 12, "y": 18, "w": 35, "h": 12, "shape": "rect"},
             "cursor": {"x": 28, "y": 24},
             "narration": {
                 "en": f"Welcome! This is the {sv['title']} screen — see how easy this is.",
                 "hi": f"नमस्ते! यह {sv['title']} स्क्रीन है — देखें कितना आसान है।",
                 "gu": f"નમસ્તે! આ {sv['title']} સ્ક્રīн છે — જુઓ કેટलું સरળ છे.",
                 "mr": f"नमस्कार! ही {sv['title']} स्क्रीन आहे — पहा किती सोपे आहे."}},
            {"id": str(uuid.uuid4()), "timestamp": 20.0, "pause_duration": 5,
             "highlight": {"x": 45, "y": 35, "w": 40, "h": 18, "shape": "rect"},
             "cursor": {"x": 65, "y": 42},
             "narration": {
                 "en": "Your data is organized here with full history — all in one place.",
                 "hi": "आपका डेटा यहां पूरे इतिहास के साथ संगठित है।",
                 "gu": "તمارो ડेटा અहीं સंपूर्ण ઇतिहास साथे छे.",
                 "mr": "तुमचा डेटा येथे पूर्ण इतिहासासह आहे."}},
            {"id": str(uuid.uuid4()), "timestamp": 45.0, "pause_duration": 5,
             "highlight": {"x": 30, "y": 55, "w": 50, "h": 15, "shape": "rect"},
             "cursor": {"x": 55, "y": 62},
             "narration": {
                 "en": "You currently have ₹3,42,000 pending. Tracking this improves cash flow.",
                 "hi": "आपके ₹3,42,000 बाकी हैं। इसे ट्रैक करना cashflow बेहतर करता है।",
                 "gu": "તمारे ₹3,42,000 બाकी छे.",
                 "mr": "तुमचे ₹3,42,000 बाकी आहेत."}},
        ]
        await db.module_videos.insert_one({
            "id": vid, "module_key": sv["module_key"], "title": sv["title"],
            "video_url": sv["video_url"], "storage_path": "", "duration": 120,
            "markers": markers, "published": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "system"
        })

    kb_seed = [
        {"q": "Does Biziverse support GSTR?",
         "a": {"en": "Yes — Biziverse handles GSTR-1, GSTR3B, e-Invoice and e-Way Bill generation directly from sales invoices.",
               "hi": "हां — Biziverse GSTR1, GSTR3B, e-Invoice और e-Way Bill सीधे बिक्री चालान से बनाता है।"},
         "tags": ["gst", "gstr", "invoice", "compliance"]},
        {"q": "I already use Tally — why switch?",
         "a": {"en": "Biziverse is a complete business platform — CRM, Sales, Inventory, Manufacturing — all in one. Tally is accounting only. You can also export data to Tally.",
               "hi": "Biziverse एक पूर्ण व्यापार प्लेटफ़ॉर्म है — CRM, बिक्री, इन्वेंटरी, मैन्युफैक्चरिंग — सब एक जगह।"},
         "tags": ["tally", "comparison", "switch"]},
        {"q": "Can I use Biziverse and Tally together?",
         "a": {"en": "Yes — some businesses use Biziverse for billing and operations and export data to Tally for their accountant's use. Both can run in parallel.",
               "hi": "हां — कुछ व्यापारी Biziverse से billing करते हैं और Tally में data export करते हैं। दोनों साथ चल सकते हैं।"},
         "tags": ["tally", "integration", "parallel", "export"]},
        {"q": "How do I track pending payments?",
         "a": {"en": "Use the Recovery module — it shows customer-wise pending amounts with auto reminders via WhatsApp & SMS.",
               "hi": "Recovery मॉड्यूल का उपयोग करें — यह WhatsApp और SMS के साथ ग्राहक-वार बकाया दिखाता है।"},
         "tags": ["recovery", "payments", "pending", "whatsapp"]},
        {"q": "Can I create invoices on mobile?",
         "a": {"en": "Yes — Biziverse mobile app lets you create GST-compliant invoices in seconds, anywhere.",
               "hi": "हां — Biziverse मोबाइल ऐप से कहीं भी GST चालान बनाएं।"},
         "tags": ["mobile", "invoice", "app"]},
    ]
    for k in kb_seed:
        await db.kb_entries.insert_one({
            "id": f"kb_{uuid.uuid4().hex[:10]}", "question": k["q"],
            "answers": k["a"], "tags": k["tags"], "active": True,
            "video_url": None, "video_start": None, "video_end": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    invalidate_kb_cache()
    return {"ok": True, "seeded_videos": len(seed_videos), "seeded_kb": len(kb_seed)}

# ========== Health ==========
@api.get("/")
async def root():
    return {"message": "Biziverse Smart Guided Demo API", "ok": True}

# Mount router
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    init_storage()
    try:
        existing = await db.module_videos.count_documents({})
        if existing == 0:
            await seed_data()
    except Exception as e:
        logger.error(f"Auto-seed failed: {e}")
    # Seed / refresh the fixed admin account from env vars (Shubham777 / 7777 by default)
    try:
        admin_uid = os.environ.get("ADMIN_USERNAME") or "Shubham777"
        admin_pwd = os.environ.get("ADMIN_PASSWORD") or "7777"
        admin_email = os.environ.get("ADMIN_EMAIL") or f"{admin_uid.lower()}@biziverse.local"
        pwd_hash = hash_password(admin_pwd)
        await db.users.update_one(
            {"user_id": admin_uid},
            {"$set": {
                "user_id": admin_uid,
                "email": admin_email,
                "name": admin_uid,
                "role": "admin",
                "password_hash": pwd_hash,
            }, "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
        logger.info(f"Admin account ready: {admin_uid}")
    except Exception as e:
        logger.error(f"Admin seed failed: {e}")

@app.on_event("shutdown")
async def shutdown_db():
    client.close()