import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { Composer } from "@/components/chat/Composer";
import { SourcesPanel } from "@/components/chat/SourcesPanel";
import { SourceModal } from "@/components/SourceModal";
import { SessionList } from "@/components/chat/SessionList";
import { ModelIndicator } from "@/components/chat/ModelIndicator";
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
import { listMyData } from "@/services/mydata";
import { ApiError } from "@/services/client";
import type { ChatMessage, ChatSession, ChatSource, ModelStatus } from "@/types";

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

export default function Chat() {
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
  const [sendError, setSendError] = useState<string | null>(null);
  const [openSource, setOpenSource] = useState<ChatSource | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const item = reduced ? riseInReduced : riseIn;

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const selectedSourceIds = activeSession?.sourceIds ?? [];
  const groundedSources = useMemo(
    () => allSources.filter((s) => selectedSourceIds.includes(s.id)),
    [allSources, selectedSourceIds],
  );

  useEffect(() => {
    listMyData().then(setAllSources);
    getModelStatus().then(setModelStatus);
    refreshSessions({ selectFirst: true });
  }, []);

  useEffect(() => {
    if (!activeSessionId) return;
    setSendError(null);
    getSessionMessages(activeSessionId).then(setMessages);
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
    const created = await createChatSession();
    setSessions((prev) => [created, ...prev]);
    setActiveSessionId(created.id);
    setMessages([]);
  }

  async function handleDeleteSession(id: string) {
    await deleteChatSession(id);
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (activeSessionId === id) {
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
          setMessages([]);
        } else {
          // No sessions left — spin up a fresh one
          createChatSession().then((created) => {
            setSessions([created]);
            setActiveSessionId(created.id);
            setMessages([]);
          });
        }
      }
      return remaining;
    });
  }

  async function handleSend(content: string, deepSearch: boolean, images?: string[]) {
    if (!activeSessionId || isModelSwitching) return;
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
      const reply = await sendSessionMessage(activeSessionId, content, deepSearch, images);
      setMessages((prev) => [...prev, reply]);
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
    await setSessionSources(activeSessionId, next);
  }

  return (
    <div className="flex h-dvh max-w-full flex-col overflow-hidden">
      <PageHeader
        eyebrow="Chat"
        title="Ask MedSys"
        action={
          <ModelIndicator
            status={modelStatus}
            onSwitchingChange={setIsModelSwitching}
          />
        }
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden lg:flex-row">
        <SessionList
          sessions={sessions}
          activeId={activeSessionId}
          open={sessionPanelOpen}
          onToggle={() => setSessionPanelOpen((v) => !v)}
          onSelect={setActiveSessionId}
          onNewChat={handleNewChat}
          onDelete={handleDeleteSession}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
            <motion.div
              className="mx-auto flex max-w-2xl flex-col gap-6"
              variants={staggerContainer(0.06)}
              initial="hidden"
              animate="show"
            >
              {messages.length === 0 && !sending && (
                <p className="py-16 text-center text-[13px] text-stone">
                  Start the conversation — ask about your symptoms, vitals, or reports.
                </p>
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

          <div className="border-t border-hairline px-5 py-4 sm:px-8">
            <div className="mx-auto max-w-2xl">
              {isModelSwitching && (
                <p className="mb-2 font-mono text-[12px] text-amber-700">
                  Model transition in progress — please wait for Ollama weights to finish loading...
                </p>
              )}
              {sendError && (
                <p className="mb-2 text-[12px] text-clay-alert">{sendError}</p>
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
