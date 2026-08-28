import React, { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { sendDoctorCopilotQuery } from "@/services/clinicalService";
import { Sparkles, Send, User, Bot, Command } from "lucide-react";

export const ClinicalCopilot: React.FC = () => {
  const [selectedPatient, setSelectedPatient] = useState<string>("pat_01");
  const [messages, setMessages] = useState<Array<{ id: string; sender: "doctor" | "ai"; text: string }>>([
    {
      id: "m_init",
      sender: "ai",
      text: "Hello Dr. Smith! I am MedSys Clinical Copilot. You can select a patient context or use @Patient in your query to analyze history, lab trends, or medication interactions.",
    },
  ]);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput("");

    setMessages((prev) => [...prev, { id: `m_${Date.now()}`, sender: "doctor", text: userText }]);
    setLoading(true);

    try {
      const res = await sendDoctorCopilotQuery(selectedPatient, userText);
      setMessages((prev) => [...prev, { id: `m_ai_${Date.now()}`, sender: "ai", text: res.reply }]);
    } catch (err) {
      console.error("Failed copilot query", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto">
      <PageHeader
        eyebrow="AI Decision Support Engine"
        title="Clinical Copilot"
        meta="Dedicated Doctor Assistant grounded in authorized patient medical history and lab trends."
      />

      <div className="px-5 sm:px-8 space-y-6">
        {/* Active Patient Context Selector */}
        <div className="flex items-center justify-between rounded-2xl border border-hairline bg-surface-card p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-teal-deep" />
            <span className="font-mono text-xs uppercase font-bold text-ink">Active Patient Context:</span>
          </div>

          <select
            value={selectedPatient}
            onChange={(e) => setSelectedPatient(e.target.value)}
            className="rounded-xl border border-hairline bg-bg-mist px-4 py-2 text-xs font-mono text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
          >
            <option value="pat_01">John Doe (pat_01)</option>
            <option value="pat_02">Emma Watson (pat_02)</option>
            <option value="pat_03">Robert Chen (pat_03)</option>
          </select>
        </div>

        {/* Chat Area */}
        <div className="rounded-2xl border border-hairline bg-surface-card p-6 min-h-[450px] max-h-[600px] overflow-y-auto space-y-4 shadow-xs">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === "doctor" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs font-sans leading-relaxed space-y-1 ${
                  msg.sender === "doctor"
                    ? "bg-ink text-bg-mist font-medium"
                    : "bg-bg-mist border border-hairline text-ink"
                }`}
              >
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-stone pb-1 border-b border-hairline">
                  {msg.sender === "doctor" ? (
                    <span>Dr. Sarah Smith</span>
                  ) : (
                    <span className="text-teal-deep font-bold flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> MedSys Clinical Copilot
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-hairline bg-bg-mist p-3 font-mono text-xs text-stone animate-pulse">
                Clinical Copilot analyzing patient context...
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
            placeholder="Ask MedSys... (e.g. 'Summarize recent history', '@JohnDoe analyze lab trends')"
            className="flex-1 bg-bg-mist border border-hairline rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-ink px-6 py-3 text-xs font-mono text-bg-mist hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            <span>Send Query</span>
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
