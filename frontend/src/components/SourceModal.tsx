import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink } from "lucide-react";
import { Markdown } from "./chat/Markdown";
import { getSourceContent } from "@/services/chat";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { KIND_ICON, KIND_LABEL } from "@/lib/sourceKinds";
import type { ChatSource, ChatSourceDetail } from "@/types";

interface SourceModalProps {
  source: ChatSource | null;
  onClose: () => void;
}

export function SourceModal({ source, onClose }: SourceModalProps) {
  const [detail, setDetail] = useState<ChatSourceDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!source) {
      setDetail(null);
      setLoadError(false);
      return;
    }
    let active = true;
    setDetail(null);
    setLoadError(false);
    getSourceContent(source)
      .then((d) => {
        if (active) setDetail(d);
      })
      .catch((err) => {
        console.error("Failed to load source content", err);
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [source]);

  useEffect(() => {
    if (!source) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [source, onClose]);

  if (!source) return null;

  const Icon = KIND_ICON[source.kind];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0.001 : 0.15 }}
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={source.title}
          className="flex max-h-[85vh] min-h-[420px] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-hairline bg-bg-mist shadow-xl sm:aspect-square"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: reduced ? 0.001 : 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
            <div className="flex min-w-0 items-start gap-2.5">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" strokeWidth={1.75} />
              <div className="min-w-0">
                <p className="truncate font-display text-[17px] leading-snug text-ink">
                  {source.title}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-stone">
                  {KIND_LABEL[source.kind]} · {source.uploadedAt}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {source.url && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open original page"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-stone transition-colors hover:bg-surface-card hover:text-ink"
                >
                  <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-stone transition-colors hover:bg-surface-card hover:text-ink"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {loadError ? (
              <p className="text-[13px] text-clay-alert">Couldn't load this document — try again.</p>
            ) : !detail ? (
              <p className="text-[13px] text-stone">Loading…</p>
            ) : (
              <div className="text-[14px] leading-relaxed text-ink/90">
                <Markdown content={detail.content || detail.snippet || ""} />
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
