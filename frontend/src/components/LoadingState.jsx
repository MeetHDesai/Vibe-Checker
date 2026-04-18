import React from "react";
import { Loader2 } from "lucide-react";

const MESSAGES = [
  "Reading the room…",
  "Filtering out the mid…",
  "Asking around…",
  "Narrowing to three…",
  "Writing the vibe…",
];

export default function LoadingState({ situationLabel }) {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % MESSAGES.length), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      data-testid="loading-state"
      className="min-h-[100dvh] flex flex-col items-center justify-center px-6 vc-fade-up"
    >
      <div className="relative w-20 h-20 mb-8">
        <div className="absolute inset-0 rounded-full border-2 border-[#2a2622]" />
        <div className="absolute inset-0 rounded-full border-2 border-t-[#f5a623] vc-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-[#f5a623] text-2xl">
          ◆
        </div>
      </div>
      <div className="text-[11px] uppercase tracking-[0.25em] text-[#9a9385] mb-3">
        {situationLabel}
      </div>
      <div
        key={i}
        className="font-display text-2xl sm:text-3xl font-bold text-center vc-fade-up"
      >
        {MESSAGES[i]}
      </div>
    </div>
  );
}
