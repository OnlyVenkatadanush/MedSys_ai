import { useState } from "react";
import { Plus, PanelLeftClose, PanelLeftOpen, Trash2 } from "lucide-react";
import type { ChatSession } from "@/types";

interface SessionListProps {
  sessions: ChatSession[];
  activeId: string | null;
  open: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => Promise<void>;
  title?: string;
  eyebrow?: string;
}

export function SessionList({
  sessions,
  activeId,
  open,
  onToggle,
  onSelect,
  onNewChat,
  onDelete,
  title = "Ask MedSys",
  eyebrow = "CHAT",
}: SessionListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <aside
      className={[
        "shrink-0 overflow-y-auto border-stone-300/60 transition-[width] duration-200 bg-[#f4f2eb]",
        open ? "w-full border-b lg:w-[260px] lg:border-b-0 lg:border-r" : "w-full lg:w-[52px] lg:border-r",
      ].join(" ")}
    >
      <div className="p-4 lg:p-6">
        {open ? (
          <div className="mb-6">
            <p className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-stone-500 mb-1">
              {eyebrow}
            </p>
            <h1 className="font-display text-3xl font-normal text-stone-900 tracking-tight">
              {title}
            </h1>
          </div>
        ) : null}

        <div className="flex items-center justify-between mb-4">
          {open && (
            <p className="font-mono text-[11px] font-semibold tracking-[0.14em] uppercase text-stone-500">
              CHATS
            </p>
          )}
          <button
            type="button"
            onClick={onToggle}
            aria-label={open ? "Collapse chat list" : "Expand chat list"}
            aria-expanded={open}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-stone-200/60 hover:text-stone-900 ${open ? "" : "mx-auto"}`}
          >
            {open ? (
              <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>
        </div>

        {open && (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={onNewChat}
              className="mb-3 flex items-center justify-start gap-2 rounded-xl border border-stone-300/80 bg-stone-200/40 px-4 py-2 text-sm font-medium text-stone-800 transition-colors duration-150 hover:bg-stone-200/80"
            >
              <Plus className="h-4 w-4 text-stone-700" strokeWidth={2} />
              New chat
            </button>

            {sessions.length === 0 ? (
              <p className="px-2 py-2 text-xs text-stone-500 font-mono">No conversations yet.</p>
            ) : (
              (() => {
                const generalSessions = sessions.filter(
                  (s) => !s.is_patient_scoped && (!s.patient_id || s.patient_id === "general")
                );
                const patientSessions = sessions.filter(
                  (s) => s.is_patient_scoped || (s.patient_id && s.patient_id !== "general")
                );

                return (
                  <div className="flex flex-col gap-4">
                    {/* General Sessions Section */}
                    {generalSessions.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 px-2 py-1">
                          <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-stone-600">
                            🌐 General Copilot
                          </span>
                        </div>
                        {generalSessions.map((session) => {
                          const isActive = session.id === activeId;
                          return (
                            <div key={session.id} className="group relative flex items-center">
                              <button
                                type="button"
                                onClick={() => onSelect(session.id)}
                                className={[
                                  "flex-1 truncate rounded-xl px-3.5 py-2 text-left text-xs font-medium transition-colors duration-150 pr-8",
                                  isActive
                                    ? "bg-[#191c24] text-white shadow-xs"
                                    : "text-stone-800 hover:bg-stone-200/50 hover:text-stone-950",
                                ].join(" ")}
                              >
                                {session.title}
                              </button>

                              <button
                                type="button"
                                aria-label={`Delete chat: ${session.title}`}
                                onClick={(e) => handleDelete(e, session.id)}
                                disabled={deletingId === session.id}
                                className={[
                                  "absolute right-2 flex h-6 w-6 items-center justify-center rounded-md transition-all duration-150 opacity-0 group-hover:opacity-100",
                                  isActive ? "text-stone-400 hover:text-white" : "text-stone-400 hover:text-red-600",
                                ].join(" ")}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Patient-Specific Sessions Section */}
                    {patientSessions.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 px-2 py-1">
                          <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-teal-800">
                            👤 Patient Isolated
                          </span>
                        </div>
                        {patientSessions.map((session) => {
                          const isActive = session.id === activeId;
                          return (
                            <div key={session.id} className="group relative flex items-center">
                              <button
                                type="button"
                                onClick={() => onSelect(session.id)}
                                className={[
                                  "flex-1 truncate rounded-xl px-3.5 py-2 text-left text-xs font-medium transition-colors duration-150 pr-8",
                                  isActive
                                    ? "bg-teal-950 text-teal-50 border border-teal-800 shadow-xs"
                                    : "border border-teal-200/60 bg-teal-50/40 text-teal-950 hover:bg-teal-100/60",
                                ].join(" ")}
                              >
                                <div className="truncate font-semibold">{session.title}</div>
                                {session.patient_name && (
                                  <div className="text-[10px] opacity-75 font-mono">
                                    Patient: {session.patient_name}
                                  </div>
                                )}
                              </button>

                              <button
                                type="button"
                                aria-label={`Delete chat: ${session.title}`}
                                onClick={(e) => handleDelete(e, session.id)}
                                disabled={deletingId === session.id}
                                className={[
                                  "absolute right-2 flex h-6 w-6 items-center justify-center rounded-md transition-all duration-150 opacity-0 group-hover:opacity-100",
                                  isActive ? "text-teal-300 hover:text-white" : "text-stone-400 hover:text-red-600",
                                ].join(" ")}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
