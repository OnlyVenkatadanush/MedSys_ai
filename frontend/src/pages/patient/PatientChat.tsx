import React, { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { sendPatientClarificationChat } from "@/services/clinicalService";
import type { PatientClarificationMessage } from "@/types";

export const PatientChat: React.FC = () => {
  const [messages, setMessages] = useState<PatientClarificationMessage[]>([
    {
      id: "msg_init",
      role: "assistant",
      content:
        "Hello! I am your MedSys AI Clarification Assistant. I can help answer questions about your doctor's published care plan, medications, side effects, or general health. How can I assist you today?",
      created_at: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput("");

    const userMsg: PatientClarificationMessage = {
      id: `msg_u_${Date.now()}`,
      role: "user",
      content: userText,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const assistantMsg = await sendPatientClarificationChat(userText);
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Failed to send chat", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          role: "assistant",
          content: "Sorry, I ran into an error connecting to the service. Please try again or contact your clinic.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Clarification & Care Grounding"
        title="AI Health Assistant"
        meta="Grounded in your attending doctor's care plan. Emergency Red Flag Triage active."
      />

      <div className="px-5 sm:px-8 space-y-4">
        {/* Chat Feed Box */}
        <div className="rounded-2xl border border-hairline bg-surface-card p-6 min-h-[450px] max-h-[600px] overflow-y-auto space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl p-4 space-y-2 ${
                    isUser
                      ? "bg-ink text-bg-mist font-medium shadow-xs"
                      : msg.is_red_flag
                      ? "bg-clay-alert/10 border-2 border-clay-alert text-ink"
                      : "bg-bg-mist border border-hairline text-ink"
                  }`}
                >
                  {!isUser && (
                    <div className="flex items-center gap-2 pb-1 border-b border-hairline font-mono text-xs font-semibold">
                      <span className={msg.is_red_flag ? "text-clay-alert font-bold" : "text-teal-deep"}>
                        {msg.is_red_flag ? "🚨 EMERGENCY TRIAGE ALERT" : "🤖 MedSys AI Assistant"}
                      </span>
                    </div>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <span className="font-mono text-[10px] opacity-60 block text-right">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-hairline bg-bg-mist p-4 font-mono text-xs text-stone animate-pulse">
                AI Assistant thinking...
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="rounded-2xl border border-hairline bg-surface-card p-2 shadow-xs flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your medication, symptoms, or care plan..."
            className="flex-1 bg-bg-mist border border-hairline rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-ink px-6 py-3 text-sm font-medium text-bg-mist hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
