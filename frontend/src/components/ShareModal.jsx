import React, { useCallback, useRef, useState } from "react";
import { toPng, toBlob } from "html-to-image";
import { X, Download, Share2, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import ShareCardTemplate from "@/components/ShareCardTemplate";

const SCALE = 3;
const CAPTURE_OPTS = {
  pixelRatio: 1,
  cacheBust: true,
  backgroundColor: "#0f0f0f",
  style: {
    transform: "none",
  },
  // Filter out style rules we don't need (speeds capture up)
  skipFonts: false,
};

export default function ShareModal({ open, onClose, picks, situation, city }) {
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const buildFilename = () =>
    `vibe-check-${situation?.id || "picks"}-${Date.now()}.png`;

  const captureNow = async (as = "blob") => {
    if (!cardRef.current) return null;
    // Small delay ensures images have painted
    await new Promise((r) => setTimeout(r, 120));
    if (as === "blob") {
      return toBlob(cardRef.current, CAPTURE_OPTS);
    }
    return toPng(cardRef.current, CAPTURE_OPTS);
  };

  const download = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const dataUrl = await captureNow("png");
      if (!dataUrl) throw new Error("Empty render");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = buildFilename();
      a.click();
      toast.success("Saved to your device");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't build the image");
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  const nativeShare = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await captureNow("blob");
      if (!blob) throw new Error("Empty render");
      const file = new File([blob], buildFilename(), { type: "image/png" });
      const shareData = {
        title: "Vibe Check",
        text: `My 3 picks${city ? ` in ${city}` : ""}`,
        files: [file],
      };
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share(shareData);
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        toast("Share not supported here — downloaded instead.");
      }
    } catch (e) {
      if (e?.name !== "AbortError") {
        console.error(e);
        toast.error("Couldn't share the image");
      }
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, city]);

  const copyText = useCallback(async () => {
    const text = picks
      .map(
        (p, i) =>
          `${i + 1}. ${p.name} — ${p.rating}★\n"${p.vibe}"\n${p.maps_url}`
      )
      .join("\n\n");
    const payload = `My 3 picks for "${situation?.title}"${city ? ` in ${city}` : ""}:\n\n${text}\n\nvia Vibe Check`;
    try {
      await navigator.clipboard.writeText(payload);
      toast.success("Copied text");
    } catch {
      toast.error("Copy failed");
    }
  }, [picks, situation, city]);

  if (!open) return null;

  return (
    <div
      data-testid="share-modal"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 sm:p-8 vc-fade-up"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#111] border border-[#2a2622] rounded-3xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2622]">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[#9a9385]">
            Share your picks
          </div>
          <button
            data-testid="share-modal-close"
            onClick={onClose}
            className="text-[#9a9385] hover:text-[#f5f1e8] p-1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview — scaled-down card */}
        <div className="overflow-auto p-5 bg-[#0c0c0c]">
          <div
            className="mx-auto rounded-2xl overflow-hidden shadow-[0_30px_80px_-30px_rgba(245,166,35,0.25)] border border-[#2a2622]"
            style={{
              width: 1080 / SCALE,
              height: 1620 / SCALE,
            }}
            aria-hidden
          >
            <div
              style={{
                transform: `scale(${1 / SCALE})`,
                transformOrigin: "top left",
                width: 1080,
                height: 1620,
              }}
            >
              <ShareCardTemplate
                ref={cardRef}
                picks={picks}
                situation={situation}
                city={city}
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#2a2622] grid grid-cols-3 gap-2">
          <button
            data-testid="share-download-btn"
            onClick={download}
            disabled={busy}
            className="flex items-center justify-center gap-2 bg-[#f5a623] text-[#0f0f0f] font-display font-bold text-sm rounded-xl py-3 hover:brightness-110 transition disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 vc-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Save
          </button>
          <button
            data-testid="share-native-btn"
            onClick={nativeShare}
            disabled={busy}
            className="flex items-center justify-center gap-2 bg-[#1a1a1a] border border-[#2a2622] hover:border-[#f5a623] text-[#f5f1e8] font-display font-bold text-sm rounded-xl py-3 transition disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 vc-spin" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            Share
          </button>
          <button
            data-testid="share-copy-btn"
            onClick={copyText}
            className="flex items-center justify-center gap-2 bg-[#1a1a1a] border border-[#2a2622] hover:border-[#f5a623] text-[#f5f1e8] font-display font-bold text-sm rounded-xl py-3 transition"
          >
            <Copy className="w-4 h-4" />
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}
