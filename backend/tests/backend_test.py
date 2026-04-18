"""
Backend API tests for Vibe Check.
Covers: /api/, /api/situations, /api/geocode, /api/recommend
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to reading frontend .env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

EXPECTED_SITUATIONS = {"focus", "quick_bite", "client_meeting", "budget", "late_night", "date_night"}


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Basic endpoints ---
class TestBasic:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        data = r.json()
        assert "situations" in data
        assert set(data["situations"]) == EXPECTED_SITUATIONS

    def test_situations(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/situations")
        assert r.status_code == 200
        data = r.json()
        assert set(data.keys()) == EXPECTED_SITUATIONS
        for v in data.values():
            assert "label" in v and isinstance(v["label"], str)


# --- Geocode ---
class TestGeocode:
    def test_geocode_valid_city(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/geocode", json={"city": "Lisbon"})
        assert r.status_code == 200
        data = r.json()
        assert "lat" in data and "lng" in data and "formatted_address" in data
        assert isinstance(data["lat"], float) and isinstance(data["lng"], float)
        # Lisbon approx 38.7, -9.1
        assert 38 < data["lat"] < 40
        assert -10 < data["lng"] < -8

    def test_geocode_nyc(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/geocode", json={"city": "New York"})
        assert r.status_code == 200
        d = r.json()
        assert 40 < d["lat"] < 41
        assert -75 < d["lng"] < -73

    def test_geocode_invalid_city(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/geocode",
            json={"city": "zzzqqqnotacityxyz123456"},
        )
        assert r.status_code == 404

    def test_geocode_missing_payload(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/geocode", json={})
        assert r.status_code == 422


# --- Recommend ---
class TestRecommend:
    # Use NYC coordinates - dense & reliable for Google Places
    NYC = {"lat": 40.7580, "lng": -73.9855}

    def test_recommend_valid(self, api_client):
        payload = {**self.NYC, "situation": "quick_bite", "city": "New York"}
        r = api_client.post(f"{BASE_URL}/api/recommend", json=payload, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["situation"] == "quick_bite"
        assert "picks" in data
        picks = data["picks"]
        assert 1 <= len(picks) <= 3
        required = {"name", "rating", "distance_m", "open_now", "maps_url", "vibe", "lat", "lng", "address"}
        for p in picks:
            missing = required - set(p.keys())
            assert not missing, f"Missing fields: {missing}"
            assert isinstance(p["vibe"], str) and len(p["vibe"].strip()) > 0
            assert p["distance_m"] <= 1500
            assert p["rating"] >= 0

    def test_recommend_unknown_situation(self, api_client):
        payload = {**self.NYC, "situation": "banana_vibes"}
        r = api_client.post(f"{BASE_URL}/api/recommend", json=payload)
        assert r.status_code == 400

    def test_recommend_invalid_payload(self, api_client):
        # Missing lat/lng
        r = api_client.post(f"{BASE_URL}/api/recommend", json={"situation": "focus"})
        assert r.status_code == 422

    def test_recommend_reverse_geocode_city(self, api_client):
        # No city provided -> should populate via reverse geocode
        payload = {**self.NYC, "situation": "focus"}
        r = api_client.post(f"{BASE_URL}/api/recommend", json=payload, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        # city should be populated (best-effort)
        assert data.get("city") is not None and len(data["city"]) > 0
