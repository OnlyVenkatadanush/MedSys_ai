import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { KIND_ICON } from "@/lib/sourceKinds";
import type { ChatSource } from "@/types";

interface SourcesPanelProps {
  sources: ChatSource[];
  open: boolean;
  onToggle: () => void;
  onOpenSource: (source: ChatSource) => void;
}

export function SourcesPanel({ sources, open, onToggle, onOpenSource }: SourcesPanelProps) {
  return (
    <aside
      className={[
        "shrink-0 overflow-y-auto border-stone-300/60 transition-[width] duration-200 bg-[#f4f2eb]",
        open ? "w-full border-t lg:w-[280px] lg:border-t-0 lg:border-l" : "w-full lg:w-[52px] lg:border-l",
      ].join(" ")}
    >
      <div className="p-4 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          {open && (
            <p className="font-mono text-[11px] font-semibold tracking-[0.2em] uppercase text-stone-500">
              GROUNDED ON
            </p>
          )}
          <button
            type="button"
            onClick={onToggle}
            aria-label={open ? "Collapse sources panel" : "Expand sources panel"}
            aria-expanded={open}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-stone-200/60 hover:text-stone-900 ${open ? "" : "mx-auto"}`}
          >
            {open ? (
              <PanelRightClose className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <PanelRightOpen className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>
        </div>

        {open && (
          <div className="flex flex-col gap-3">
            {sources.length === 0 ? (
              <p className="text-xs leading-relaxed text-stone-500 font-sans">
                Nothing grounding this conversation. Use the paperclip icon to pick records from My Data, or ask a question that needs a web search.
              </p>
            ) : (
              sources.map((source) => {
                const Icon = KIND_ICON[source.kind];
                return (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => onOpenSource(source)}
                    className="rounded-xl border border-stone-300/80 bg-white/80 p-3.5 text-left shadow-xs transition-colors duration-150 hover:border-stone-800 hover:bg-white"
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-stone-800" strokeWidth={1.75} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-stone-900">{source.title}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-stone-500">
                          {source.uploadedAt}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-3 text-[11.5px] leading-relaxed text-stone-600">
                      {source.excerpt}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

