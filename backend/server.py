"""Smart Guided Demo - Biziverse - Full Backend."""
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Header, Cookie, Response, Request, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, io, json, random, string, requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

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

from fastapi import Depends

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
    pause_duration: float = 0  # 0 = wait for user
    highlight: Optional[Dict[str, Any]] = None  # {x,y,w,h,shape}
    cursor: Optional[Dict[str, float]] = None  # {x,y}
    narration: Dict[str, str] = {}  # lang -> text

class ModuleVideoIn(BaseModel):
    model_config = {"extra": "allow"}
    module_key: str
    title: str
    video_url: str = ""
    storage_path: str = ""
    duration: float = 0
    markers: List[Dict[str, Any]] = []
    chapters: List[Dict[str, Any]] = []   # [{name, start, end}]
    published: bool = False
    biziverse_url: Optional[str] = None
    show_try_yourself: bool = True
    target_languages: List[str] = []        # empty = all
    target_business_types: List[str] = []   # empty = all
    target_product_categories: List[str] = []  # empty = all

class FlowIn(BaseModel):
    business_type: str
    product_category: str
    modules: List[str]
    name: str
    video_sequence: List[str] = []  # module_video ids in order
    transition_text: Dict[str, str] = {}  # lang -> "Now showing"
    status: str = "draft"  # draft | active

class KBEntryIn(BaseModel):
    question: str
    answers: Dict[str, str] = {}  # lang -> answer
    tags: List[str] = []
    linked_mini_demo_id: Optional[str] = None
    active: bool = True

class MiniDemoIn(BaseModel):
    name: str
    module_video_id: Optional[str] = None
    steps: List[Dict[str, Any]] = []  # [{narration:{lang:txt}, target, action, duration}]

class QuizOptionsIn(BaseModel):
    business_types: List[Dict[str, Any]]  # [{key, label:{lang:txt}}]
    product_categories: Dict[str, List[Dict[str, Any]]]  # {bt: [{key,label}]}
    modules: Dict[str, List[str]]  # {"bt|pc": [module_keys]}

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
            "role": "editor",  # default editor
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
        {"key": "distributor", "label": {"en": "Distributor", "hi": "वितरक", "gu": "વિતરક", "mr": "वितरक"}},
        {"key": "retail", "label": {"en": "Retail Store", "hi": "खुदरा दुकान", "gu": "છૂટક દુકાન", "mr": "किरकोळ दुकान"}},
        {"key": "manufacturer", "label": {"en": "Manufacturer", "hi": "निर्माता", "gu": "ઉત્પાદક", "mr": "उत्पादक"}},
        {"key": "service", "label": {"en": "Service Provider", "hi": "सेवा प्रदाता", "gu": "સેવા પ્રદાતા", "mr": "सेवा प्रदाता"}},
        {"key": "ecom", "label": {"en": "E-commerce Seller", "hi": "ई-कॉमर्स विक्रेता", "gu": "ઈ-કોમર્સ વિક્રેતા", "mr": "ई-कॉमर्स विक्रेता"}},
        {"key": "contractor", "label": {"en": "Contractor", "hi": "ठेकेदार", "gu": "કોન્ટ્રાક્ટર", "mr": "कंत्राटदार"}},
    ],
    "product_categories": {
        "wholesale": [{"key": "textiles", "label": {"en": "Textiles & Apparel"}},
                      {"key": "electronics", "label": {"en": "Electronics"}},
                      {"key": "fmcg", "label": {"en": "FMCG / Groceries"}},
                      {"key": "hardware", "label": {"en": "Hardware & Tools"}},
                      {"key": "other_w", "label": {"en": "Other"}}],
        "distributor": [{"key": "fmcg", "label": {"en": "FMCG"}},
                        {"key": "pharma", "label": {"en": "Pharma"}},
                        {"key": "auto", "label": {"en": "Auto Parts"}},
                        {"key": "other_d", "label": {"en": "Other"}}],
        "retail": [{"key": "kirana", "label": {"en": "Kirana / Grocery"}},
                   {"key": "fashion", "label": {"en": "Fashion"}},
                   {"key": "mobile", "label": {"en": "Mobile & Electronics"}},
                   {"key": "other_r", "label": {"en": "Other"}}],
        "manufacturer": [{"key": "engineering", "label": {"en": "Engineering"}},
                         {"key": "food", "label": {"en": "Food Processing"}},
                         {"key": "chemicals", "label": {"en": "Chemicals"}},
                         {"key": "other_m", "label": {"en": "Other"}}],
        "service": [{"key": "it", "label": {"en": "IT Services"}},
                    {"key": "consulting", "label": {"en": "Consulting"}},
                    {"key": "other_s", "label": {"en": "Other"}}],
        "ecom": [{"key": "fashion_e", "label": {"en": "Fashion"}},
                 {"key": "electronics_e", "label": {"en": "Electronics"}},
                 {"key": "other_e", "label": {"en": "Other"}}],
        "contractor": [{"key": "construction", "label": {"en": "Construction"}},
                       {"key": "interior", "label": {"en": "Interior"}},
                       {"key": "other_c", "label": {"en": "Other"}}],
    },
    "modules": {
        "_default": ["crm", "quotes", "sales_orders", "sales_invoices", "recovery", "contracts",
                     "tickets", "customers", "accounts", "purchases", "purchase_orders",
                     "inventory", "manufacturing", "projects", "tasks", "suppliers", "store", "reports"]
    }
}

MODULE_LABELS = {
    "crm": {"en": "Manage Inquiries / Leads (CRM)", "hi": "CRM / लीड्स", "gu": "CRM / લીડ્સ", "mr": "CRM / लीड्स"},
    "quotes": {"en": "Quotes & Proforma Invoice", "hi": "कोटेशन"},
    "sales_orders": {"en": "Sales Orders"},
    "sales_invoices": {"en": "Sales Invoices (GST, e-Invoice, e-Way Bill, DC)"},
    "recovery": {"en": "Recovery (Payment Tracking & Reminders)"},
    "contracts": {"en": "Contracts (AMC & Renewals)"},
    "tickets": {"en": "Support Tickets"},
    "customers": {"en": "Customer Master"},
    "accounts": {"en": "Accounts"},
    "purchases": {"en": "Purchases (Invoice, GRN, GSTR3)"},
    "purchase_orders": {"en": "Purchase Orders"},
    "inventory": {"en": "Inventory (Batch-wise)"},
    "manufacturing": {"en": "Manufacturing (Backflush, Job)"},
    "projects": {"en": "Projects"},
    "tasks": {"en": "Tasks"},
    "suppliers": {"en": "Suppliers Master"},
    "store": {"en": "Your Store (Webstore)"},
    "reports": {"en": "Reports"},
}

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
    # Modules: filtered by which have published videos
    pub_videos = await db.module_videos.find({"published": True}, {"_id": 0, "module_key": 1}).to_list(1000)
    available_modules = list({v["module_key"] for v in pub_videos})
    # honor admin-configured per-segment
    cfg_mods = cfg.get("modules", {}).get(f"{business_type}|{product_category}") or cfg.get("modules", {}).get("_default", [])
    final = [m for m in cfg_mods if m in available_modules]
    if not final:
        final = available_modules  # fallback show all available
    out = [{"key": m, "label": MODULE_LABELS.get(m, {"en": m})} for m in final]
    return {"modules": out}

@api.post("/quiz/submit")
async def quiz_submit(payload: QuizSubmit):
    sid = payload.session_id or f"sess_{uuid.uuid4().hex[:12]}"
    # Resolution: try combination flow first
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
        # Fallback to individual videos in workflow order
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

# ========== AI Chat (KB + LLM) ==========
async def search_kb(question: str, lang: str):
    """Smart KB search: returns either:
    - {match: kb_entry, confidence: high} if very confident
    - {clarify: [kb_entries]} if multiple candidates need disambiguation
    - None if no decent match
    """
    q_lower = question.lower().strip()
    entries = await db.kb_entries.find({"active": True}, {"_id": 0}).to_list(500)
    if not entries:
        return None

    STOP = {"the","a","an","is","are","do","does","what","how","can","i","you","my","to","for","of","in","on","at","with","this","that","it","as","be","by","or","and","not","no","yes","please","help","me","tell","about"}

    def tokens(text):
        return [w.strip(".,?!;:'\"") for w in text.lower().split() if w.strip(".,?!;:'\"") and w.strip(".,?!;:'\"") not in STOP and len(w) > 2]

    q_tokens = set(tokens(question))
    if not q_tokens:
        return None

    scored = []
    for e in entries:
        kb_text = e["question"] + " " + " ".join(e.get("tags", []))
        kb_tokens = set(tokens(kb_text))
        if not kb_tokens:
            continue
        # Jaccard + coverage of user tokens
        overlap = q_tokens & kb_tokens
        union = q_tokens | kb_tokens
        if not overlap:
            continue
        jaccard = len(overlap) / len(union)
        coverage = len(overlap) / max(len(q_tokens), 1)  # how much of user question is matched
        kb_coverage = len(overlap) / max(len(kb_tokens), 1)  # how much of KB question is matched
        score = (jaccard * 0.4) + (coverage * 0.3) + (kb_coverage * 0.3)
        scored.append((score, jaccard, coverage, e))

    if not scored:
        return None

    scored.sort(key=lambda x: -x[0])
    top_score, top_jacc, top_cov, top_entry = scored[0]

    # Very confident match
    if top_score >= 0.55 and top_cov >= 0.6:
        return {"match": top_entry}

    # Candidate cluster: multiple decent matches → ask user to clarify
    candidates = [e for s, _, _, e in scored[:4] if s >= 0.20]
    if len(candidates) >= 1 and top_score < 0.55:
        return {"clarify": candidates}

    return None

@api.post("/ai/chat")
async def ai_chat(payload: ChatIn):
    q = (payload.message or "").strip()
    q_lower = q.lower()
    lang_names = {"en": "English", "hi": "Hindi", "gu": "Gujarati", "mr": "Marathi"}

    # Strict mode: handle greetings, then KB, otherwise log + return executive prompt
    greetings = ["hi", "hello", "hey", "namaste", "hii", "helo", "hola", "नमस्ते", "नमस्कार"]
    if any(q_lower == g or q_lower.startswith(g + " ") or q_lower.startswith(g + ",") for g in greetings):
        greet = {
            "en": "Hi! I can answer questions about Biziverse features. What would you like to know?",
            "hi": "नमस्ते! मैं Biziverse के बारे में सवालों के जवाब दे सकता हूँ। आप क्या जानना चाहेंगे?",
            "gu": "નમસ્તે! હું Biziverse વિશે પ્રશ્નોના જવાબ આપી શકું છું.",
            "mr": "नमस्कार! मी Biziverse विषयी प्रश्नांची उत्तरे देऊ शकतो."
        }
        return {"answer": greet.get(payload.language, greet["en"]), "linked_mini_demo_id": None,
                "from_kb": False, "no_answer": False, "video_url": None}

    kb_hit = await search_kb(q, payload.language)

    # Clarification flow — ambiguous match, ask user to pick
    if kb_hit and "clarify" in kb_hit:
        candidates = kb_hit["clarify"]
        clarify_text = {
            "en": "I'm not 100% sure. Did you mean one of these?",
            "hi": "मुझे पूरी तरह से समझ नहीं आया। क्या आपका मतलब इनमें से कुछ है?",
            "gu": "મને બરાબર સમજાયું નથી. શું તમારો અર્થ આમાંથી કોઈ છે?",
            "mr": "मला पूर्ण समजले नाही. यापैकी काही म्हणायचे आहे का?",
        }
        return {
            "answer": clarify_text.get(payload.language, clarify_text["en"]),
            "clarify": True,
            "candidates": [{"question": c["question"], "id": c["id"]} for c in candidates],
            "from_kb": False, "no_answer": False, "video_url": None, "linked_mini_demo_id": None,
        }

    if kb_hit and "match" in kb_hit:
        e = kb_hit["match"]
        ans = e.get("answers", {}).get(payload.language) or e.get("answers", {}).get("en") or ""
        return {
            "answer": ans,
            "linked_mini_demo_id": e.get("linked_mini_demo_id"),
            "video_url": e.get("video_url"),
            "video_start": e.get("video_start"),
            "video_end": e.get("video_end"),
            "kb_question": e.get("question"),
            "from_kb": True,
            "no_answer": False
        }

    # Log unanswered question for admin review
    await db.unanswered_questions.insert_one({
        "id": f"uq_{uuid.uuid4().hex[:10]}",
        "session_id": payload.session_id,
        "question": q,
        "language": payload.language,
        "business_type": payload.business_type,
        "product_category": payload.product_category,
        "modules": payload.modules or [],
        "resolved": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    fallback = {
        "en": "I don't have an answer for that yet. Would you like to talk with an executive?",
        "hi": "मेरे पास इसका जवाब अभी नहीं है। क्या आप किसी executive से बात करना चाहेंगे?",
        "gu": "મારી પાસે હાલ આ જવાબ નથી. શું તમે executive સાથે વાત કરવા માંગો છો?",
        "mr": "माझ्याकडे या प्रश्नाचे उत्तर अद्याप नाही. कार्यकारीशी बोलू इच्छिता?"
    }
    return {"answer": fallback.get(payload.language, fallback["en"]),
            "linked_mini_demo_id": None, "video_url": None,
            "from_kb": False, "no_answer": True}

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
    return {"ok": True, "mock_otp": code}  # MOCKED: returned to client for demo

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
    # Persist signup intent
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
    # MOCKED Razorpay
    plan_amount = 99900 if payload.plan == "monthly" else 999900
    order_id = f"order_mock_{uuid.uuid4().hex[:10]}"
    await db.payments.insert_one({
        "order_id": order_id, "mobile": payload.mobile, "plan": payload.plan,
        "amount": plan_amount, "status": "success",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"ok": True, "order_id": order_id, "amount": plan_amount, "status": "success", "mocked": True}

# ========== Settings ==========
@api.get("/settings")
async def get_settings_public():
    s = await db.settings.find_one({"_id": "main"}, {"_id": 0}) or {}
    return {
        "show_executive_cta": s.get("show_executive_cta", True),
        "executive_phone": s.get("executive_phone", ""),
    }

@api.get("/admin/settings")
async def get_settings(user=Depends(admin_dep)):
    s = await db.settings.find_one({"_id": "main"}, {"_id": 0}) or {}
    return s

@api.put("/admin/settings")
async def set_settings(payload: Dict[str, Any], user=Depends(admin_dep)):
    await db.settings.update_one({"_id": "main"}, {"$set": payload}, upsert=True)
    return await db.settings.find_one({"_id": "main"}, {"_id": 0}) or {}

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
    # check duplicate
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
    kid = f"kb_{uuid.uuid4().hex[:10]}"
    doc = payload.model_dump()
    doc.update({"id": kid, "created_at": datetime.now(timezone.utc).isoformat()})
    await db.kb_entries.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/admin/kb/{kid}")
async def update_kb(kid: str, payload: KBEntryIn, user=Depends(admin_dep)):
    await db.kb_entries.update_one({"id": kid}, {"$set": payload.model_dump()})
    return await db.kb_entries.find_one({"id": kid}, {"_id": 0})

@api.delete("/admin/kb/{kid}")
async def delete_kb(kid: str, user=Depends(admin_dep)):
    await db.kb_entries.delete_one({"id": kid})
    return {"ok": True}

# ========== Public Mini-Demos ==========
@api.get("/mini-demos/{mid}")
async def get_mini_demo_public(mid: str):
    m = await db.mini_demos.find_one({"id": mid}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Not found")
    # Attach linked video if any
    if m.get("module_video_id"):
        v = await db.module_videos.find_one({"id": m["module_video_id"]}, {"_id": 0})
        m["video"] = v
    return m

# ========== Admin: Mini-Demos ==========
@api.get("/admin/mini-demos")
async def list_mini_demos(user=Depends(admin_dep)):
    return await db.mini_demos.find({}, {"_id": 0}).to_list(500)

@api.post("/admin/mini-demos")
async def create_mini(payload: MiniDemoIn, user=Depends(admin_dep)):
    mid = f"mini_{uuid.uuid4().hex[:10]}"
    doc = payload.model_dump()
    doc.update({"id": mid, "created_at": datetime.now(timezone.utc).isoformat()})
    await db.mini_demos.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.delete("/admin/mini-demos/{mid}")
async def delete_mini(mid: str, user=Depends(admin_dep)):
    await db.mini_demos.delete_one({"id": mid})
    return {"ok": True}

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
    paid = await db.payments.count_documents({"status": "success"})

    funnel_data = [
        {"stage": "Landing", "count": sessions_total},
        {"stage": "Quiz Completed", "count": quiz_done},
        {"stage": "Demo Started", "count": len(demo_started)},
        {"stage": "Demo Ended", "count": len(conversion_views)},
        {"stage": "Offers Selected", "count": len(signup_init)},
        {"stage": "Callbacks Scheduled", "count": await db.events.count_documents({"event_type": "callback_requested"})},
    ]
    # popular flows
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
    # Check if already seeded
    existing = await db.module_videos.count_documents({})
    if existing > 0:
        return {"ok": True, "already_seeded": True}

    # Seed the two real videos provided by user
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
                 "gu": f"નમસ્તે! આ {sv['title']} સ્ક્રીન છે — જુઓ કેટલું સરળ છે.",
                 "mr": f"नमस्कार! ही {sv['title']} स्क्रीन आहे — पहा किती सोपे आहे."}},
            {"id": str(uuid.uuid4()), "timestamp": 20.0, "pause_duration": 5,
             "highlight": {"x": 45, "y": 35, "w": 40, "h": 18, "shape": "rect"},
             "cursor": {"x": 65, "y": 42},
             "narration": {
                 "en": "Your data is organized here with full history — all in one place.",
                 "hi": "आपका डेटा यहां पूरे इतिहास के साथ संगठित है।",
                 "gu": "તમારો ડેટા અહીં સંપૂર્ણ ઇતિહાસ સાથે છે.",
                 "mr": "तुमचा डेटा येथे पूर्ण इतिहासासह आहे."}},
            {"id": str(uuid.uuid4()), "timestamp": 45.0, "pause_duration": 5,
             "highlight": {"x": 30, "y": 55, "w": 50, "h": 15, "shape": "rect"},
             "cursor": {"x": 55, "y": 62},
             "narration": {
                 "en": "You currently have ₹3,42,000 pending. Tracking this improves cash flow.",
                 "hi": "आपके ₹3,42,000 बाकी हैं। इसे ट्रैक करना cashflow बेहतर करता है।",
                 "gu": "તમારે ₹3,42,000 બાકી છે.",
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

    # KB entries
    kb_seed = [
        {"q": "Does Biziverse support GST?",
         "a": {"en": "Yes — Biziverse handles GSTR1, GSTR3B, e-Invoice and e-Way Bill generation directly from sales invoices.",
               "hi": "हां — Biziverse GSTR1, GSTR3B, e-Invoice और e-Way Bill सीधे बिक्री चालान से बनाता है।"},
         "tags": ["gst", "invoice", "compliance"]},
        {"q": "I already use Tally — why switch?",
         "a": {"en": "Biziverse is a complete business platform — CRM, Sales, Inventory, Manufacturing — all in one. Tally is accounting only. You can also export data to Tally.",
               "hi": "Biziverse एक पूर्ण व्यापार प्लेटफ़ॉर्म है — CRM, बिक्री, इन्वेंटरी, मैन्युफैक्चरिंग — सब एक जगह।"},
         "tags": ["tally", "comparison", "switch"]},
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
            "linked_mini_demo_id": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    # Seed a sample mini-demo and link it to the GST KB entry
    first_video = await db.module_videos.find_one({"module_key": "sales_invoices"}, {"_id": 0})
    if first_video:
        mini_id = f"mini_{uuid.uuid4().hex[:10]}"
        await db.mini_demos.insert_one({
            "id": mini_id,
            "name": "How GST Invoice Works",
            "module_video_id": first_video["id"],
            "steps": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        # Link to GST KB entry
        await db.kb_entries.update_one(
            {"question": {"$regex": "GST", "$options": "i"}},
            {"$set": {"linked_mini_demo_id": mini_id}}
        )

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
    # Auto-seed
    try:
        existing = await db.module_videos.count_documents({})
        if existing == 0:
            await seed_data()
    except Exception as e:
        logger.error(f"Auto-seed failed: {e}")

@app.on_event("shutdown")
async def shutdown_db():
    client.close()
