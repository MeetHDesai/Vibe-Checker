import React, { useState } from "react";
import { MapPin, Share2, ChevronLeft, RefreshCcw } from "lucide-react";
import PickCard from "@/components/PickCard";
import ShareModal from "@/components/ShareModal";

export default function Results({
  picks,
  situation,
  city,
  origin,
  onBack,
  onNew,
  onReroll,
  rerollingIdx,
}) {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div data-testid="results-screen" className="min-h-[100dvh] px-5 sm:px-8 pt-6 pb-20 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6 vc-fade-up">
        <button
          data-testid="results-back"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[#9a9385] hover:text-[#f5f1e8] text-sm"
        >
          <ChevronLeft className="w-4 h-4" /> back
        </button>
        <button
          data-testid="share-btn"
          onClick={() => setShareOpen(true)}
          className="inline-flex items-center gap-2 bg-[#161616] border border-[#2a2622] hover:border-[#f5a623] text-[#f5f1e8] text-sm rounded-full px-4 py-2 transition"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>

      <div className="mb-8 vc-fade-up" style={{ animationDelay: "60ms" }}>
        <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#9a9385]">
          <span className="text-lg leading-none">{situation.emoji}</span>
          <span>{situation.title}</span>
          {city && (
            <>
              <span className="opacity-40">·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#f5a623]" /> {city}
              </span>
            </>
          )}
        </div>
        <h2 className="font-display text-4xl sm:text-5xl font-extrabold leading-[0.95] mt-3">
          Go here.<br />
          <span className="text-[#f5a623]">Thank us later.</span>
        </h2>
      </div>

      <div className="space-y-4">
        {picks.map((p, idx) => (
          <PickCard
            key={p.place_id}
            pick={p}
            index={idx}
            origin={origin}
            onReroll={onReroll}
            rerolling={rerollingIdx === idx}
          />
        ))}
      </div>

      <div className="mt-10 text-center vc-fade-up" style={{ animationDelay: "520ms" }}>
        <button
          data-testid="try-again-btn"
          onClick={onNew}
          className="inline-flex items-center gap-2 text-sm text-[#9a9385] hover:text-[#f5f1e8] border border-[#2a2622] hover:border-[#f5a623] rounded-full px-5 py-2.5 transition"
        >
          <RefreshCcw className="w-4 h-4" />
          Different vibe
        </button>
      </div>

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        picks={picks}
        situation={situation}
        city={city}
      />
    </div>
  );
}
