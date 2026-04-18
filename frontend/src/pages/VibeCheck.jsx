import React, { useCallback, useState } from "react";
import axios from "axios";
import LocationPrompt from "@/components/LocationPrompt";
import SituationPicker from "@/components/SituationPicker";
import LoadingState from "@/components/LoadingState";
import Results from "@/components/Results";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function VibeCheck() {
  const [stage, setStage] = useState("location"); // location | picker | loading | results | error
  const [coords, setCoords] = useState(null);
  const [city, setCity] = useState(null);
  const [situation, setSituation] = useState(null);
  const [picks, setPicks] = useState([]);
  const [errMsg, setErrMsg] = useState("");

  const handleCoords = useCallback(({ lat, lng }) => {
    setCoords({ lat, lng });
    setCity(null);
    setStage("picker");
  }, []);

  const handleCity = useCallback(async (cityStr) => {
    try {
      const { data } = await axios.post(`${API}/geocode`, { city: cityStr });
      setCoords({ lat: data.lat, lng: data.lng });
      setCity(data.formatted_address || cityStr);
      setStage("picker");
    } catch (e) {
      toast.error("Couldn't find that city");
    }
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
        if (data.city && !city) setCity(data.city);
        if (!data.picks || data.picks.length === 0) {
          setErrMsg("No vibe-worthy spots nearby. Try another situation.");
          setStage("error");
        } else {
          setStage("results");
        }
      } catch (e) {
        const detail = e?.response?.data?.detail || "Something went sideways.";
        setErrMsg(detail);
        setStage("error");
      }
    },
    [coords, city]
  );

  if (stage === "location") {
    return <LocationPrompt onCoords={handleCoords} onManualCity={handleCity} />;
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
        onBack={() => setStage("picker")}
        onNew={() => setStage("picker")}
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
