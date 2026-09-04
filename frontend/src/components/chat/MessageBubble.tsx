import { motion } from "framer-motion";
import { fadeUpMessage } from "@/lib/motion";
import { Markdown } from "./Markdown";
import type { ChatMessage } from "@/types";

export function MessageBubble({
  message,
  onSelectOption,
}: {
  message: ChatMessage;
  onSelectOption?: (option: string) => void;
}) {
  const isUser = message.sender === "user" || message.role === "user";
  const rawDate = message.createdAt || message.created_at || Date.now();
  const time = new Date(rawDate).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <motion.div
      variants={fadeUpMessage}
      initial="hidden"
      animate="show"
      className={`flex min-w-0 max-w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[92%] sm:max-w-[88%] min-w-0 ${isUser ? "text-right" : "text-left"}`}>
        {isUser ? (
          <div className="inline-block rounded-2xl bg-[#191c24] px-4 py-3 text-left shadow-xs">
            <p className="text-[14px] leading-relaxed text-white font-medium">
              {message.content || message.message || ""}
            </p>
          </div>
        ) : (
          <div
            className={`min-w-0 max-w-full overflow-hidden text-[14px] leading-relaxed text-stone-900 ${
              message.isRedFlag
                ? "rounded-2xl border-2 border-red-500 bg-red-50/70 p-4.5 shadow-md shadow-red-500/10"
                : ""
            }`}
          >
            {message.isRedFlag && (
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-mono font-bold text-white shadow-xs">
                <span className="animate-pulse text-sm">🚨</span>
                <span>CRITICAL CLINICAL EMERGENCY ALERT</span>
              </div>
            )}

            {message.adapter_used && (
              <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-teal-600/30 bg-teal-50 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-teal-900 shadow-2xs">
                <span className="text-teal-600 font-bold">⚡</span>
                <span>{message.adapter_used} Adapter</span>
              </div>
            )}

            <Markdown content={message.content || message.message || ""} />

            {/* 1-CLICK EMERGENCY ACTION HANDOFF BUTTONS */}
            {message.isRedFlag && (
              <div className="mt-4 pt-3 border-t border-red-200/80 space-y-2">
                <span className="block font-mono text-[11px] uppercase tracking-wider font-bold text-red-900">
                  Immediate Emergency Actions:
                </span>
                <div className="flex flex-wrap items-center gap-2.5">
                  <a
                    href="tel:911"
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-mono font-bold text-white shadow-sm hover:bg-red-700 transition-colors"
                  >
                    <span>📞</span>
                    <span>Call Emergency (911 / 112)</span>
                  </a>
                  <a
                    href="/find-care"
                    className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-xs font-mono font-bold text-red-800 shadow-sm hover:bg-red-50 transition-colors"
                  >
                    <span>🏥</span>
                    <span>Locate Nearest Emergency ER</span>
                  </a>
                </div>
              </div>
            )}

            {message.quickOptions && message.quickOptions.length > 0 && !message.isRedFlag && (
              <div className="mt-3.5 flex flex-wrap gap-2 pt-2">
                {message.quickOptions.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectOption?.(option)}
                    className="rounded-full border border-stone-300/80 bg-white/80 px-3.5 py-1 text-xs font-medium text-stone-800 transition-colors hover:bg-stone-200/80"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <span className="mt-1.5 block font-mono text-[11px] text-stone-500">
          {time}
        </span>
      </div>
    </motion.div>
  );
}

