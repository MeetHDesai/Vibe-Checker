import React, { useCallback, useState } from "react";
import axios from "axios";
import LocationPrompt from "@/components/LocationPrompt";
import SituationPicker from "@/components/SituationPicker";
import LoadingState from "@/components/LoadingState";
import Results from "@/components/Results";
import RateLimitedScreen from "@/components/RateLimitedScreen";
import { saveLastLocation, pushRecentCity } from "@/lib/storage";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function VibeCheck() {
  const [stage, setStage] = useState("location"); // location | picker | loading | results | error
  const [coords, setCoords] = useState(null);
  const [city, setCity] = useState(null);
  const [situation, setSituation] = useState(null);
  const [picks, setPicks] = useState([]);
  const [errMsg, setErrMsg] = useState("");
  const [retryAfter, setRetryAfter] = useState(0);
  const [rerollingIdx, setRerollingIdx] = useState(-1);

  const handleCoords = useCallback(({ lat, lng }) => {
    setCoords({ lat, lng });
    setCity(null);
    saveLastLocation({ lat, lng, city: null, source: "geo" });
    setStage("picker");
  }, []);

  const handleCity = useCallback(async (cityStr) => {
    try {
      const { data } = await axios.post(`${API}/geocode`, { city: cityStr });
      const resolvedCity = data.formatted_address || cityStr;
      setCoords({ lat: data.lat, lng: data.lng });
      setCity(resolvedCity);
      saveLastLocation({
        lat: data.lat,
        lng: data.lng,
        city: resolvedCity,
        source: "manual",
      });
      pushRecentCity({ lat: data.lat, lng: data.lng, city: resolvedCity });
      setStage("picker");
    } catch (e) {
      toast.error("Couldn't find that city");
    }
  }, []);

  const handleSavedLocation = useCallback(({ lat, lng, city: savedCity }) => {
    setCoords({ lat, lng });
    setCity(savedCity || null);
    saveLastLocation({
      lat,
      lng,
      city: savedCity || null,
      source: savedCity ? "manual" : "geo",
    });
    setStage("picker");
  }, []);

  const handlePickSituation = useCallback(
    async (s) => {
      setSituation(s);
      setStage("loading");
      setErrMsg("");
      try {
        const { data } = await axios.post(`${API}/recommend`, {
          lat: coords.lat,
          lng: coords.lng,
          situation: s.id,
          city: city,
        });
        setPicks(data.picks || []);
        if (data.city && !city) {
          setCity(data.city);
          // Also persist the reverse-geocoded city as recent
          pushRecentCity({ lat: coords.lat, lng: coords.lng, city: data.city });
          saveLastLocation({
            lat: coords.lat,
            lng: coords.lng,
            city: data.city,
            source: "geo",
          });
        }
        if (!data.picks || data.picks.length === 0) {
          setErrMsg("No vibe-worthy spots nearby. Try another situation.");
          setStage("error");
        } else {
          setStage("results");
        }
      } catch (e) {
        const status = e?.response?.status;
        const detail = e?.response?.data?.detail;
        if (status === 429 && detail && typeof detail === "object") {
          setErrMsg(detail.message || "Too many requests. Try again shortly.");
          setRetryAfter(detail.retry_after || 30);
          setStage("rate_limited");
        } else {
          const msg =
            (typeof detail === "string" && detail) ||
            detail?.message ||
            "Something went sideways.";
          setErrMsg(msg);
          setStage("error");
        }
      }
    },
    [coords, city]
  );

  const handleReroll = useCallback(
    async (placeId, idx) => {
      if (rerollingIdx !== -1) return;
      setRerollingIdx(idx);
      try {
        const exclude = picks.map((p) => p.place_id);
        const { data } = await axios.post(`${API}/reroll`, {
          lat: coords.lat,
          lng: coords.lng,
          situation: situation.id,
          city: city,
          exclude,
        });
        if (data?.pick) {
          setPicks((prev) => prev.map((p, i) => (i === idx ? data.pick : p)));
        }
      } catch (e) {
        const status = e?.response?.status;
        const detail = e?.response?.data?.detail;
        if (status === 429 && detail && typeof detail === "object") {
          toast.error(detail.message || "Too many tries — slow down.");
        } else if (status === 404) {
          toast.error(
            typeof detail === "string" ? detail : "No more options nearby."
          );
        } else {
          toast.error("Couldn't swap that one. Try again.");
        }
      } finally {
        setRerollingIdx(-1);
      }
    },
    [coords, city, situation, picks, rerollingIdx]
  );

  if (stage === "location") {
    return (
      <LocationPrompt
        onCoords={handleCoords}
        onManualCity={handleCity}
        onSavedLocation={handleSavedLocation}
      />
    );
  }
  if (stage === "picker") {
    return (
      <SituationPicker
        city={city}
        onPick={handlePickSituation}
        onBack={() => setStage("location")}
      />
    );
  }
  if (stage === "loading") {
    return <LoadingState situationLabel={situation?.title} />;
  }
  if (stage === "results") {
    return (
      <Results
        picks={picks}
        situation={situation}
        city={city}
        origin={coords}
        onBack={() => setStage("picker")}
        onNew={() => setStage("picker")}
        onReroll={handleReroll}
        rerollingIdx={rerollingIdx}
      />
    );
  }
  if (stage === "rate_limited") {
    return (
      <RateLimitedScreen
        message={errMsg}
        retryAfter={retryAfter}
        onDone={() => setStage("picker")}
      />
    );
  }
  // error
  return (
    <div
      data-testid="error-screen"
      className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center vc-fade-up"
    >
      <div className="text-5xl mb-5">🫠</div>
      <h2 className="font-display text-3xl font-bold">Dead zone.</h2>
      <p className="mt-3 text-[#9a9385] max-w-sm">{errMsg}</p>
      <button
        data-testid="error-back-btn"
        onClick={() => setStage("picker")}
        className="mt-8 bg-[#f5a623] text-[#0f0f0f] font-display font-bold px-6 py-3 rounded-full"
      >
        Try another vibe
      </button>
    </div>
  );
}
