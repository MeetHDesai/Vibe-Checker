from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import math
import json
import time
import logging
import asyncio
import httpx
from collections import deque
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Deque, Dict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection (kept for template consistency, unused by this app)
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

GOOGLE_MAPS_API_KEY = os.environ['GOOGLE_MAPS_API_KEY']
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']

app = FastAPI(title="Vibe Check API")
api_router = APIRouter(prefix="/api")

# --------- Rate limiter (in-memory sliding window, per IP) ---------
RECOMMEND_LIMIT = 5          # max requests
RECOMMEND_WINDOW_SEC = 60    # per window
_rate_buckets: Dict[str, Deque[float]] = {}


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit_recommend(request: Request):
    """Raises 429 if this IP has exceeded RECOMMEND_LIMIT requests in the last window."""
    ip = _client_ip(request)
    now = time.time()
    bucket = _rate_buckets.setdefault(ip, deque())
    # drop expired
    while bucket and now - bucket[0] > RECOMMEND_WINDOW_SEC:
        bucket.popleft()
    if len(bucket) >= RECOMMEND_LIMIT:
        retry_after = int(RECOMMEND_WINDOW_SEC - (now - bucket[0])) + 1
        raise HTTPException(
            status_code=429,
            detail={
                "message": "Whoa, slow down. Take a breath, pick a vibe, and try again in a sec.",
                "retry_after": max(retry_after, 1),
                "limit": RECOMMEND_LIMIT,
                "window_sec": RECOMMEND_WINDOW_SEC,
            },
            headers={"Retry-After": str(max(retry_after, 1))},
        )
    bucket.append(now)

# --------- Situation config ---------
# Each situation maps to Google Places query params + a vibe hint for Claude
SITUATIONS = {
    "focus": {
        "label": "Need to focus",
        "type": "cafe",
        "keyword": "quiet wifi workspace",
        "require_open_now": True,
        "min_rating": 4.0,
        "vibe_hint": "quiet, laptop-friendly, great for deep work",
    },
    "quick_bite": {
        "label": "Quick bite",
        "type": "restaurant",
        "keyword": "fast casual",
        "require_open_now": True,
        "min_rating": 4.0,
        "vibe_hint": "fast, delicious, close by",
    },
    "client_meeting": {
        "label": "Client meeting",
        "type": "restaurant",
        "keyword": "upscale quiet",
        "require_open_now": True,
        "min_rating": 4.2,
        "vibe_hint": "upscale, quiet, professional atmosphere",
    },
    "budget": {
        "label": "On a budget",
        "type": "restaurant",
        "keyword": "cheap eats",
        "require_open_now": True,
        "min_rating": 4.0,
        "vibe_hint": "affordable, great value, honest food",
    },
    "late_night": {
        "label": "Late night",
        "type": "restaurant",
        "keyword": "late night open now",
        "require_open_now": True,
        "min_rating": 4.0,
        "vibe_hint": "open late, energetic, still serving",
    },
    "date_night": {
        "label": "Date night",
        "type": "restaurant",
        "keyword": "romantic cozy",
        "require_open_now": True,
        "min_rating": 4.2,
        "vibe_hint": "cozy, intimate, perfect ambiance",
    },
}


# --------- Models ---------
class RecommendRequest(BaseModel):
    lat: float
    lng: float
    situation: str
    city: Optional[str] = None


class PlaceResult(BaseModel):
    place_id: str
    name: str
    rating: float
    user_ratings_total: int = 0
    distance_m: int
    open_now: bool
    address: str
    price_level: Optional[int] = None
    maps_url: str
    vibe: str
    photo_url: Optional[str] = None
    lat: float
    lng: float


class RecommendResponse(BaseModel):
    situation: str
    city: Optional[str] = None
    picks: List[PlaceResult]


class GeocodeRequest(BaseModel):
    city: str


class GeocodeResponse(BaseModel):
    lat: float
    lng: float
    formatted_address: str


# --------- Utilities ---------
def haversine_m(lat1, lng1, lat2, lng2):
    r = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return int(r * c)


async def google_nearby_search(lat: float, lng: float, situation_cfg: dict):
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{lat},{lng}",
        "radius": 1500,
        "type": situation_cfg["type"],
        "keyword": situation_cfg["keyword"],
        "key": GOOGLE_MAPS_API_KEY,
    }
    if situation_cfg.get("require_open_now"):
        params["opennow"] = "true"
    async with httpx.AsyncClient(timeout=15.0) as hc:
        r = await hc.get(url, params=params)
        data = r.json()
    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        raise HTTPException(
            status_code=502,
            detail=f"Google Places error: {data.get('status')} {data.get('error_message', '')}",
        )
    return data.get("results", [])


async def reverse_geocode_city(lat: float, lng: float) -> Optional[str]:
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {"latlng": f"{lat},{lng}", "key": GOOGLE_MAPS_API_KEY, "result_type": "locality"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as hc:
            r = await hc.get(url, params=params)
            data = r.json()
        if data.get("status") == "OK" and data.get("results"):
            for comp in data["results"][0].get("address_components", []):
                if "locality" in comp.get("types", []):
                    return comp.get("long_name")
            return data["results"][0].get("formatted_address")
    except Exception as e:
        logging.warning(f"reverse geocode failed: {e}")
    return None


def build_photo_url(photo_reference: str) -> str:
    return (
        f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800"
        f"&photo_reference={photo_reference}&key={GOOGLE_MAPS_API_KEY}"
    )


async def generate_vibes(picks: List[dict], city: Optional[str], vibe_hint: str) -> List[str]:
    """Generate vibe descriptions for multiple places in a single LLM call."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id="vibe-check",
        system_message=(
            "You are a confident local friend giving one-line recommendations. "
            "Your descriptions are vivid, specific, and feel spoken, not written. "
            "Never use review-speak ('offers', 'features', 'boasts'). "
            "Each line must be under 18 words, no emojis, no quotes."
        ),
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    city_txt = f" in {city}" if city else ""
    lines = []
    for i, p in enumerate(picks, 1):
        lines.append(
            f"{i}. {p['name']} — rated {p['rating']}/5, {p.get('type_label', 'place')}{city_txt}. Context: {vibe_hint}."
        )
    prompt = (
        "Write ONE short vibe description for each place below, like a friend texting me. "
        "Return STRICT JSON array of strings in the same order. No preamble.\n\n"
        + "\n".join(lines)
    )

    try:
        resp = await chat.send_message(UserMessage(text=prompt))
        text = resp.strip()
        # Strip code fences if present
        if text.startswith("```"):
            text = text.split("```", 2)[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip().rstrip("`").strip()
        arr = json.loads(text)
        if isinstance(arr, list) and len(arr) >= len(picks):
            return [str(x).strip().strip('"') for x in arr[: len(picks)]]
    except Exception as e:
        logging.warning(f"Vibe generation failed, using fallback: {e}")

    # Fallback vibes
    return [f"{vibe_hint.capitalize()}. A solid call." for _ in picks]


# --------- Routes ---------
@api_router.get("/")
async def root():
    return {"message": "Vibe Check API", "situations": list(SITUATIONS.keys())}


@api_router.get("/situations")
async def get_situations():
    return {k: {"label": v["label"]} for k, v in SITUATIONS.items()}


@api_router.post("/geocode", response_model=GeocodeResponse)
async def geocode(req: GeocodeRequest):
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {"address": req.city, "key": GOOGLE_MAPS_API_KEY}
    async with httpx.AsyncClient(timeout=10.0) as hc:
        r = await hc.get(url, params=params)
        data = r.json()
    if data.get("status") != "OK" or not data.get("results"):
        raise HTTPException(status_code=404, detail="City not found")
    res = data["results"][0]
    loc = res["geometry"]["location"]
    return GeocodeResponse(lat=loc["lat"], lng=loc["lng"], formatted_address=res["formatted_address"])


@api_router.post("/recommend", response_model=RecommendResponse)
async def recommend(req: RecommendRequest, request: Request):
    rate_limit_recommend(request)
    cfg = SITUATIONS.get(req.situation)
    if not cfg:
        raise HTTPException(status_code=400, detail="Unknown situation")

    results = await google_nearby_search(req.lat, req.lng, cfg)

    # Filter and score
    scored = []
    for p in results:
        rating = p.get("rating")
        if not rating or rating < cfg["min_rating"]:
            continue
        loc = p.get("geometry", {}).get("location") or {}
        if "lat" not in loc or "lng" not in loc:
            continue
        dist = haversine_m(req.lat, req.lng, loc["lat"], loc["lng"])
        if dist > 1500:
            continue
        # rating × (1/distance). Use dist+50 to avoid div by tiny numbers
        score = rating * (1.0 / max(dist + 50, 50))
        scored.append((score, dist, p))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:3]

    # If too few results, relax (drop min_rating a bit) to still return something
    if len(top) < 3:
        relaxed = []
        for p in results:
            rating = p.get("rating") or 0
            loc = p.get("geometry", {}).get("location") or {}
            if "lat" not in loc or "lng" not in loc:
                continue
            dist = haversine_m(req.lat, req.lng, loc["lat"], loc["lng"])
            if dist > 1500:
                continue
            score = (rating or 3.5) * (1.0 / max(dist + 50, 50))
            relaxed.append((score, dist, p))
        relaxed.sort(key=lambda x: x[0], reverse=True)
        # Merge, dedupe by place_id
        seen = {p[2].get("place_id") for p in top}
        for item in relaxed:
            if len(top) >= 3:
                break
            if item[2].get("place_id") not in seen:
                top.append(item)
                seen.add(item[2].get("place_id"))

    if not top:
        raise HTTPException(
            status_code=404,
            detail="No vibe-worthy spots within 1.5km. Try a different situation or move around.",
        )

    # Resolve city (for vibe hint) — best-effort
    city = req.city
    if not city:
        city = await reverse_geocode_city(req.lat, req.lng)

    # Build simple dicts for LLM
    simple = []
    for _, dist, p in top:
        simple.append(
            {
                "name": p.get("name"),
                "rating": p.get("rating"),
                "type_label": cfg["label"].lower(),
            }
        )

    vibes = await generate_vibes(simple, city, cfg["vibe_hint"])

    picks: List[PlaceResult] = []
    for (score, dist, p), vibe in zip(top, vibes):
        loc = p["geometry"]["location"]
        photo_ref = None
        photos = p.get("photos") or []
        if photos:
            photo_ref = photos[0].get("photo_reference")
        picks.append(
            PlaceResult(
                place_id=p.get("place_id", ""),
                name=p.get("name", "Unknown"),
                rating=float(p.get("rating") or 0),
                user_ratings_total=int(p.get("user_ratings_total") or 0),
                distance_m=dist,
                open_now=bool((p.get("opening_hours") or {}).get("open_now", cfg.get("require_open_now", False))),
                address=p.get("vicinity") or p.get("formatted_address") or "",
                price_level=p.get("price_level"),
                maps_url=f"https://www.google.com/maps/search/?api=1&query={loc['lat']},{loc['lng']}&query_place_id={p.get('place_id', '')}",
                vibe=vibe,
                photo_url=build_photo_url(photo_ref) if photo_ref else None,
                lat=loc["lat"],
                lng=loc["lng"],
            )
        )

    return RecommendResponse(situation=req.situation, city=city, picks=picks)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
