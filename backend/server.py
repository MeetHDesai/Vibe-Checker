from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
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
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ['DB_NAME']]

GOOGLE_MAPS_API_KEY = os.environ['GOOGLE_MAPS_API_KEY']
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']

app = FastAPI(title="Vibe Check API")
api_router = APIRouter(prefix="/api")

# --------- Rate limiter (in-memory sliding window, per IP) ---------
RECOMMEND_LIMIT = 5
RECOMMEND_WINDOW_SEC = 60
_rate_buckets: Dict[str, Deque[float]] = {}


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit_recommend(request: Request):
    ip = _client_ip(request)
    now = time.time()
    bucket = _rate_buckets.setdefault(ip, deque())
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


# --------- Nearby-search cache (for reroll) ---------
NEARBY_CACHE_TTL_SEC = 300
_nearby_cache: Dict[str, tuple] = {}


def _cache_key(lat: float, lng: float, situation: str) -> str:
    return f"{round(lat, 3)}|{round(lng, 3)}|{situation}"


def _cache_put(lat: float, lng: float, situation: str, scored: list) -> None:
    _nearby_cache[_cache_key(lat, lng, situation)] = (time.time(), scored)


def _cache_get(lat: float, lng: float, situation: str) -> Optional[list]:
    entry = _nearby_cache.get(_cache_key(lat, lng, situation))
    if not entry:
        return None
    ts, scored = entry
    if time.time() - ts > NEARBY_CACHE_TTL_SEC:
        return None
    return scored


# --------- Situation config ---------
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


class PlaceDetailsRequest(BaseModel):
    place_id: str
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None


class PlaceReview(BaseModel):
    author: str
    rating: int
    text: str
    relative_time: Optional[str] = None


class PlaceDetailsResponse(BaseModel):
    place_id: str
    name: str
    phone: Optional[str] = None
    website: Optional[str] = None
    weekday_text: List[str] = []
    open_now: Optional[bool] = None
    top_review: Optional[PlaceReview] = None
    walking_minutes: Optional[int] = None
    summary: Optional[str] = None


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
    return f"/api/place_photo?ref={photo_reference}&maxwidth=800"


@api_router.get("/place_photo")
async def place_photo(ref: str, maxwidth: int = 800):
    upstream = "https://maps.googleapis.com/maps/api/place/photo"
    params = {"photo_reference": ref, "maxwidth": maxwidth, "key": GOOGLE_MAPS_API_KEY}
    try:
        http_client = httpx.AsyncClient(timeout=20.0, follow_redirects=True)
        r = await http_client.get(upstream, params=params)
        if r.status_code != 200:
            await http_client.aclose()
            raise HTTPException(status_code=502, detail="Photo fetch failed")
        content_type = r.headers.get("content-type", "image/jpeg")
        body = r.content
        await http_client.aclose()
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Photo fetch failed")

    return StreamingResponse(
        iter([body]),
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=86400, immutable",
            "Access-Control-Allow-Origin": "*",
        },
    )


async def generate_vibes(picks: List[dict], city: Optional[str], vibe_hint: str) -> List[str]:
    """Generate vibe descriptions for multiple places in a single LLM call."""
    from anthropic import AsyncAnthropic

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
        anthropic_client = AsyncAnthropic(api_key=EMERGENT_LLM_KEY)
        message = await anthropic_client.messages.create(
            model="claude-sonnet-4-5-20250514",
            max_tokens=600,
            system=(
                "You are a confident local friend giving one-line recommendations. "
                "Your descriptions are vivid, specific, and feel spoken, not written. "
                "Never use review-speak ('offers', 'features', 'boasts'). "
                "Each line must be under 18 words, no emojis, no quotes."
            ),
            messages=[{"role": "user", "content": prompt}],
        )
        text = ""
        for block in message.content:
            if getattr(block, "type", None) == "text":
                text = block.text
                break
        text = (text or "").strip()
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


@api_router.post("/place_details", response_model=PlaceDetailsResponse)
async def place_details(req: PlaceDetailsRequest):
    url = "https://maps.googleapis.com/maps/api/place/details/json"
    fields = [
        "name",
        "formatted_phone_number",
        "international_phone_number",
        "website",
        "current_opening_hours",
        "opening_hours",
        "reviews",
        "geometry",
        "editorial_summary",
    ]
    params = {
        "place_id": req.place_id,
        "fields": ",".join(fields),
        "reviews_sort": "most_relevant",
        "key": GOOGLE_MAPS_API_KEY,
    }
    async with httpx.AsyncClient(timeout=12.0) as hc:
        r = await hc.get(url, params=params)
        data = r.json()

    if data.get("status") != "OK":
        raise HTTPException(
            status_code=502,
            detail=f"Place details error: {data.get('status')} {data.get('error_message', '')}",
        )

    d = data.get("result", {}) or {}
    hours = d.get("current_opening_hours") or d.get("opening_hours") or {}
    weekday_text = hours.get("weekday_text") or []
    open_now = hours.get("open_now")
    reviews = d.get("reviews") or []
    top_rev: Optional[PlaceReview] = None
    if reviews:
        best = sorted(
            reviews,
            key=lambda r: (r.get("rating", 0), len(r.get("text", "") or "")),
            reverse=True,
        )[0]
        text = (best.get("text") or "").strip()
        if len(text) > 320:
            text = text[:317].rstrip() + "…"
        top_rev = PlaceReview(
            author=best.get("author_name") or "Anonymous",
            rating=int(best.get("rating") or 0),
            text=text,
            relative_time=best.get("relative_time_description"),
        )

    walking_minutes: Optional[int] = None
    loc = (d.get("geometry") or {}).get("location")
    if loc and req.origin_lat is not None and req.origin_lng is not None:
        straight_m = haversine_m(req.origin_lat, req.origin_lng, loc["lat"], loc["lng"])
        walking_minutes = max(1, int(round((straight_m * 1.25) / 80)))

    summary = (d.get("editorial_summary") or {}).get("overview")

    return PlaceDetailsResponse(
        place_id=req.place_id,
        name=d.get("name") or "Unknown",
        phone=d.get("formatted_phone_number") or d.get("international_phone_number"),
        website=d.get("website"),
        weekday_text=weekday_text,
        open_now=open_now,
        top_review=top_rev,
        walking_minutes=walking_minutes,
        summary=summary,
    )


def _score_results(results: list, origin_lat: float, origin_lng: float, cfg: dict) -> list:
    scored = []
    for p in results:
        rating = p.get("rating")
        if not rating or rating < cfg["min_rating"]:
            continue
        loc = p.get("geometry", {}).get("location") or {}
        if "lat" not in loc or "lng" not in loc:
            continue
        dist = haversine_m(origin_lat, origin_lng, loc["lat"], loc["lng"])
        if dist > 1500:
            continue
        score = rating * (1.0 / max(dist + 50, 50))
        scored.append((score, dist, p))
    seen_ids = {p[2].get("place_id") for p in scored}
    relaxed: list = []
    for p in results:
        pid = p.get("place_id")
        if pid in seen_ids:
            continue
        loc = p.get("geometry", {}).get("location") or {}
        if "lat" not in loc or "lng" not in loc:
            continue
        dist = haversine_m(origin_lat, origin_lng, loc["lat"], loc["lng"])
        if dist > 1500:
            continue
        rating = p.get("rating") or 3.5
        score = rating * (1.0 / max(dist + 50, 50))
        relaxed.append((score, dist, p))
    scored.sort(key=lambda x: x[0], reverse=True)
    relaxed.sort(key=lambda x: x[0], reverse=True)
    return scored + relaxed


def _build_place_result(scored_item: tuple, vibe: str, cfg: dict) -> "PlaceResult":
    _score, dist, p = scored_item
    loc = p["geometry"]["location"]
    photos = p.get("photos") or []
    photo_ref = photos[0].get("photo_reference") if photos else None
    return PlaceResult(
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


async def _get_or_fetch_scored(lat: float, lng: float, situation: str, cfg: dict) -> list:
    cached = _cache_get(lat, lng, situation)
    if cached is not None:
        return cached
    results = await google_nearby_search(lat, lng, cfg)
    scored = _score_results(results, lat, lng, cfg)
    _cache_put(lat, lng, situation, scored)
    return scored


@api_router.post("/recommend", response_model=RecommendResponse)
async def recommend(req: RecommendRequest, request: Request):
    rate_limit_recommend(request)
    cfg = SITUATIONS.get(req.situation)
    if not cfg:
        raise HTTPException(status_code=400, detail="Unknown situation")

    scored = await _get_or_fetch_scored(req.lat, req.lng, req.situation, cfg)
    top = scored[:3]

    if not top:
        raise HTTPException(
            status_code=404,
            detail="No vibe-worthy spots within 1.5km. Try a different situation or move around.",
        )

    city = req.city
    if not city:
        city = await reverse_geocode_city(req.lat, req.lng)

    simple = [
        {"name": p.get("name"), "rating": p.get("rating"), "type_label": cfg["label"].lower()}
        for _, _, p in top
    ]
    vibes = await generate_vibes(simple, city, cfg["vibe_hint"])

    picks: List[PlaceResult] = [
        _build_place_result(item, vibe, cfg) for item, vibe in zip(top, vibes)
    ]
    return RecommendResponse(situation=req.situation, city=city, picks=picks)


class RerollRequest(BaseModel):
    lat: float
    lng: float
    situation: str
    city: Optional[str] = None
    exclude: List[str] = Field(default_factory=list)


class RerollResponse(BaseModel):
    situation: str
    pick: PlaceResult


@api_router.post("/reroll", response_model=RerollResponse)
async def reroll(req: RerollRequest, request: Request):
    rate_limit_recommend(request)
    cfg = SITUATIONS.get(req.situation)
    if not cfg:
        raise HTTPException(status_code=400, detail="Unknown situation")

    scored = await _get_or_fetch_scored(req.lat, req.lng, req.situation, cfg)
    exclude = set(req.exclude or [])
    next_item = None
    for item in scored:
        pid = item[2].get("place_id")
        if pid and pid not in exclude:
            next_item = item
            break

    if next_item is None:
        raise HTTPException(
            status_code=404,
            detail="Out of fresh options. Try a different vibe or move around.",
        )

    city = req.city
    if not city:
        city = await reverse_geocode_city(req.lat, req.lng)

    simple = [
        {
            "name": next_item[2].get("name"),
            "rating": next_item[2].get("rating"),
            "type_label": cfg["label"].lower(),
        }
    ]
    vibes = await generate_vibes(simple, city, cfg["vibe_hint"])
    pick = _build_place_result(next_item, vibes[0], cfg)
    return RerollResponse(situation=req.situation, pick=pick)


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
    mongo_client.close()
