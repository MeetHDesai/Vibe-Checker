import React, { useEffect, useState } from "react";
import { Timer } from "lucide-react";

export default function RateLimitedScreen({ message, retryAfter, onDone }) {
  const [secs, setSecs] = useState(Math.max(1, Math.floor(retryAfter || 30)));

  useEffect(() => {
    if (secs <= 0) return;
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secs]);

  const pct = retryAfter > 0 ? Math.max(0, (secs / retryAfter) * 100) : 0;

  return (
    <div
      data-testid="rate-limited-screen"
      className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center vc-fade-up"
    >
      <div className="w-16 h-16 rounded-full border-2 border-[#f5a623] flex items-center justify-center mb-6 relative">
        <Timer className="w-7 h-7 text-[#f5a623]" />
      </div>
      <div className="text-[11px] uppercase tracking-[0.25em] text-[#9a9385] mb-3">
        Easy there
      </div>
      <h2 className="font-display text-3xl sm:text-4xl font-bold max-w-md leading-tight">
        {message}
      </h2>

      <div
        className="mt-8 w-full max-w-xs h-1 rounded-full bg-[#2a2622] overflow-hidden"
        aria-hidden
      >
        <div
          className="h-full bg-[#f5a623] transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        data-testid="rate-limited-countdown"
        className="mt-3 text-sm text-[#9a9385]"
      >
        {secs > 0 ? (
          <>Try again in <span className="text-[#f5f1e8] font-semibold">{secs}s</span></>
        ) : (
          "Good to go."
        )}
      </div>

      <button
        data-testid="rate-limited-retry"
        onClick={onDone}
        disabled={secs > 0}
        className="mt-8 bg-[#f5a623] text-[#0f0f0f] font-display font-bold px-6 py-3 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
      >
        {secs > 0 ? "Cooling down…" : "Pick another vibe"}
      </button>
    </div>
  );
}
