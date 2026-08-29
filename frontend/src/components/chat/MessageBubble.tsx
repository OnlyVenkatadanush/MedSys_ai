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
                ? "rounded-2xl border-2 border-red-500 bg-red-50/50 p-4"
                : ""
            }`}
          >
            <Markdown content={message.content || message.message || ""} />

            {message.quickOptions && message.quickOptions.length > 0 && (
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

