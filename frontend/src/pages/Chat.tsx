import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { Composer } from "@/components/chat/Composer";
import { SourcesPanel } from "@/components/chat/SourcesPanel";
import { SourceModal } from "@/components/SourceModal";
import { SessionList } from "@/components/chat/SessionList";
import { ModelIndicator, type ModelOption } from "@/components/chat/ModelIndicator";
import { staggerContainer, riseIn, riseInReduced } from "@/lib/motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  createChatSession,
  deleteChatSession,
  getModelStatus,
  getSessionMessages,
  listChatSessions,
  sendSessionMessage,
  setSessionSources,
} from "@/services/chat";
import { fetchAssignedPatients, sendDoctorCopilotQuery } from "@/services/clinicalService";
import { listMyData } from "@/services/mydata";
import { ApiError } from "@/services/client";
import { User } from "lucide-react";
import type { ChatMessage, ChatSession, ChatSource, DoctorPatientAssignment, ModelStatus } from "@/types";

function describeSendError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      return "Your session may have expired — refresh the page and try again.";
    }
    if (err.status) {
      const reason = err.detail ? `: ${err.detail}` : "";
      return `Couldn't get a reply — the backend returned an error (${err.status})${reason}.`;
    }
  }
  return "Couldn't get a reply — the backend may be unreachable. Check it's running, then try again.";
}

export interface ChatProps {
  title?: string;
  eyebrow?: string;
  doctorMode?: boolean;
}

export default function Chat({
  title = "Ask MedSys",
  eyebrow = "CHAT",
  doctorMode = false,
}: ChatProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [allSources, setAllSources] = useState<ChatSource[]>([]);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [sessionPanelOpen, setSessionPanelOpen] = useState(true);
  const [sourcesPanelOpen, setSourcesPanelOpen] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendingDeepSearch, setSendingDeepSearch] = useState(false);
  const [isModelSwitching, setIsModelSwitching] = useState(false);
  const [activeSpecialty, setActiveSpecialty] = useState<string>("General Medicine");
  const [sendError, setSendError] = useState<string | null>(null);
  const [openSource, setOpenSource] = useState<ChatSource | null>(null);
  const [assignedPatients, setAssignedPatients] = useState<DoctorPatientAssignment[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const reduced = useReducedMotion();
  const item = reduced ? riseInReduced : riseIn;

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const selectedSourceIds = activeSession?.sourceIds ?? [];
  const groundedSources = useMemo(
    () => allSources.filter((s) => selectedSourceIds.includes(s.id)),
    [allSources, selectedSourceIds],
  );

  useEffect(() => {
    // Guards against React StrictMode's dev-only double-invoke of mount
    // effects: without this, a first-time visitor with zero existing
    // sessions had refreshSessions() run twice concurrently, each seeing
    // an empty list and independently creating its own "New chat" —
    // producing two duplicate empty sessions in the sidebar. The ref
    // itself survives StrictMode's synthetic unmount/remount, so this
    // still only runs once per real mount.
    if (initializedRef.current) return;
    initializedRef.current = true;
    listMyData().then(setAllSources).catch((err) => console.error("Failed to load sources", err));
    getModelStatus().then(setModelStatus).catch((err) => console.error("Failed to load model status", err));
    refreshSessions({ selectFirst: true }).catch((err) => console.error("Failed to load chat sessions", err));
    if (doctorMode) {
      fetchAssignedPatients()
        .then((patients) => {
          setAssignedPatients(patients);
          if (patients.length > 0) setSelectedPatient(patients[0].patient_id);
        })
        .catch((err) => console.error("Failed to load assigned patients", err));
    }
  }, []);

  useEffect(() => {
    if (!activeSessionId) return;
    setSendError(null);
    getSessionMessages(activeSessionId)
      .then(setMessages)
      .catch((err) => console.error("Failed to load session messages", err));
  }, [activeSessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function refreshSessions(options?: { selectFirst?: boolean }) {
    const list = await listChatSessions();
    if (list.length === 0) {
      const created = await createChatSession();
      setSessions([created]);
      setActiveSessionId(created.id);
      return;
    }
    setSessions(list);
    if (options?.selectFirst) setActiveSessionId(list[0].id);
  }

  async function handleNewChat() {
    try {
      const created = await createChatSession();
      setSessions((prev) => [created, ...prev]);
      setActiveSessionId(created.id);
      setMessages([]);
    } catch (err) {
      console.error("Failed to create chat session", err);
    }
  }

  async function handleDeleteSession(id: string) {
    try {
      await deleteChatSession(id);
    } catch (err) {
      console.error("Failed to delete chat session", err);
      return;
    }
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (activeSessionId === id) {
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
          setMessages([]);
        } else {
          createChatSession()
            .then((created) => {
              setSessions([created]);
              setActiveSessionId(created.id);
              setMessages([]);
            })
            .catch((err) => console.error("Failed to create replacement chat session", err));
        }
      }
      return remaining;
    });
  }

  async function handleSend(content: string, deepSearch: boolean, images?: string[]) {
    if (!activeSessionId || isModelSwitching) return;
    if (doctorMode && !selectedPatient) {
      setSendError("Assign a patient to your panel before starting a copilot conversation.");
      return;
    }
    const userMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);
    setSendingDeepSearch(deepSearch);
    setSendError(null);

    try {
      if (doctorMode) {
        // Clinical Copilot query
        const res = await sendDoctorCopilotQuery(selectedPatient, content);
        const replyMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: res.reply,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, replyMessage]);
      } else {
        // Patient session chat
        const reply = await sendSessionMessage(activeSessionId, content, deepSearch, images, activeSpecialty);
        setMessages((prev) => [...prev, reply]);
      }
      await Promise.all([refreshSessions(), listMyData().then(setAllSources)]);
    } catch (err) {
      setSendError(describeSendError(err));
    } finally {
      setSending(false);
      setSendingDeepSearch(false);
    }
  }

  async function handleToggleSource(sourceId: string) {
    if (!activeSessionId) return;
    const next = selectedSourceIds.includes(sourceId)
      ? selectedSourceIds.filter((id) => id !== sourceId)
      : [...selectedSourceIds, sourceId];
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? { ...s, sourceIds: next } : s)),
    );
    try {
      await setSessionSources(activeSessionId, next);
    } catch (err) {
      console.error("Failed to update session sources", err);
    }
  }

  return (
    <div className="flex h-dvh max-w-full flex-col overflow-hidden bg-[#f4f2eb] text-stone-900 font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden lg:flex-row">
        {/* Left Column: Sessions List */}
        <SessionList
          sessions={sessions}
          activeId={activeSessionId}
          open={sessionPanelOpen}
          onToggle={() => setSessionPanelOpen((v) => !v)}
          onSelect={setActiveSessionId}
          onNewChat={handleNewChat}
          onDelete={handleDeleteSession}
          title={title}
          eyebrow={eyebrow}
        />

        {/* Center Main Chat Column */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-[#f4f2eb]">
          {/* Top Bar with Model Status */}
          <div className="flex items-center justify-between gap-4 w-full px-6 pt-5 pb-3 border-b border-stone-300/40 shrink-0">
            {doctorMode ? (
              <div className="flex items-center gap-2 text-xs font-mono text-stone-700 shrink-0">
                <User className="h-3.5 w-3.5 text-stone-800" />
                <span className="font-semibold uppercase tracking-wider text-stone-600">Patient:</span>
                <select
                  value={selectedPatient}
                  onChange={(e) => setSelectedPatient(e.target.value)}
                  disabled={assignedPatients.length === 0}
                  className="rounded-xl border border-stone-300/80 bg-white px-3 py-1 font-mono text-xs font-semibold text-stone-900 shadow-2xs focus:outline-none focus:ring-1 focus:ring-stone-800 disabled:opacity-50"
                >
                  {assignedPatients.length === 0 ? (
                    <option value="">No patients assigned</option>
                  ) : (
                    assignedPatients.map((p) => (
                      <option key={p.patient_id} value={p.patient_id}>
                        {p.patient_name} ({p.patient_id})
                      </option>
                    ))
                  )}
                </select>
              </div>
            ) : (
              <div className="text-xs font-mono text-stone-500 tracking-wider uppercase font-semibold">
                AI Clinical Companion
              </div>
            )}

            <div className="flex items-center justify-end shrink-0 ml-auto">
              <ModelIndicator
                status={modelStatus}
                onSwitchingChange={setIsModelSwitching}
                onModelChange={(model: ModelOption) => setActiveSpecialty(model.specialty)}
              />
            </div>
          </div>

          {/* Scrollable Message Feed */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
            <motion.div
              className="mx-auto flex max-w-3xl flex-col gap-6"
              variants={staggerContainer(0.06)}
              initial="hidden"
              animate="show"
            >
              {messages.length === 0 && !sending && (
                <div className="py-24 text-center">
                  <p className="font-display text-2xl text-stone-400 font-normal mb-2">
                    How can I assist your health today?
                  </p>
                  <p className="text-xs font-mono text-stone-500">
                    Ask about symptoms, vitals, drug interactions, or upload medical reports.
                  </p>
                </div>
              )}

              {messages.map((message) => (
                <motion.div key={message.id} variants={item}>
                  <MessageBubble
                    message={message}
                    onSelectOption={(opt) => handleSend(opt, false)}
                  />
                </motion.div>
              ))}

              {sending && (
                <TypingIndicator label={sendingDeepSearch ? "Searching the web…" : undefined} />
              )}
            </motion.div>
          </div>

          {/* Floating Pill Composer Footer */}
          <div className="px-5 py-4 sm:px-8 shrink-0">
            <div className="mx-auto max-w-3xl">
              {isModelSwitching && (
                <p className="mb-2 font-mono text-xs text-amber-700 text-center">
                  Model transition in progress — loading Ollama weights into VRAM...
                </p>
              )}
              {sendError && (
                <p className="mb-2 text-xs text-red-600 text-center font-medium">{sendError}</p>
              )}
              <Composer
                onSend={handleSend}
                availableSources={allSources}
                selectedSourceIds={selectedSourceIds}
                onToggleSource={handleToggleSource}
                disabled={sending || isModelSwitching}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Grounded On Sources Panel */}
        <SourcesPanel
          sources={groundedSources}
          open={sourcesPanelOpen}
          onToggle={() => setSourcesPanelOpen((v) => !v)}
          onOpenSource={setOpenSource}
        />
      </div>

      <SourceModal source={openSource} onClose={() => setOpenSource(null)} />
    </div>
  );
}

