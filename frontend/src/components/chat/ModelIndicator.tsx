import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Check,
  Loader2,
  Cpu,
  Terminal,
  X,
  Minimize2,
  CheckCircle2,
  Stethoscope,
  Scan,
  Activity,
  Microscope,
  Eye,
  FileText,
  Brain,
  Sparkles,
  Server,
} from "lucide-react";
import type { ModelStatus } from "@/types";

export interface ModelOption {
  id: string;
  name: string;
  specialty: string;
  description: string;
  iconName: string;
}

export const MEDGEMMA_MODELS: ModelOption[] = [
  {
    id: "hf.co/unsloth/medgemma-4b-it-GGUF:Q4_K_M",
    name: "MedGemma 4B Base",
    specialty: "General Medicine",
    description: "Standard multimodal medical LLM for general clinical queries",
    iconName: "Stethoscope",
  },
  {
    id: "hf.co/unsloth/medgemma-4b-it-GGUF:Q4_K_M-Radiology",
    name: "MedGemma 4B Radiology",
    specialty: "Radiology",
    description: "Finetuned for CT scans, MRI, ultrasound, and radiological reporting",
    iconName: "Scan",
  },
  {
    id: "hf.co/unsloth/medgemma-4b-it-GGUF:Q4_K_M-Dermatology",
    name: "MedGemma 4B Dermatology",
    specialty: "Dermatology",
    description: "Specialized in skin lesion classification, rash evaluation & dermoscopy",
    iconName: "Activity",
  },
  {
    id: "hf.co/unsloth/medgemma-4b-it-GGUF:Q4_K_M-pathology",
    name: "MedGemma 4B Pathology",
    specialty: "Pathology",
    description: "Optimized for tissue histology, biopsy interpretation & cell pathology",
    iconName: "Microscope",
  },
  {
    id: "hf.co/unsloth/medgemma-4b-it-GGUF:Q4_K_M-opthamology",
    name: "MedGemma 4B Ophthalmology",
    specialty: "Ophthalmology",
    description: "Specialized in fundus imaging, retinal OCT scans & ocular conditions",
    iconName: "Eye",
  },
  {
    id: "hf.co/unsloth/medgemma-4b-it-GGUF:Q4_K_M-chest-x-ray",
    name: "MedGemma 4B Chest X-Ray",
    specialty: "Chest X-Ray",
    description: "Trained on thoracic radiographs, pneumothorax & pulmonary opacities",
    iconName: "FileText",
  },
  {
    id: "hf.co/unsloth/medgemma-4b-it-GGUF:Q4_K_M-clinical reasoning",
    name: "MedGemma 4B Clinical Reasoning",
    specialty: "Clinical Reasoning",
    description: "Enhanced step-by-step differential diagnosis & clinical logic",
    iconName: "Brain",
  },
];

const TOTAL_SWITCH_DURATION_MS = 60000; // 60 seconds (1 min)

function renderIcon(iconName: string, className: string) {
  switch (iconName) {
    case "Stethoscope":
      return <Stethoscope className={className} />;
    case "Scan":
      return <Scan className={className} />;
    case "Activity":
      return <Activity className={className} />;
    case "Microscope":
      return <Microscope className={className} />;
    case "Eye":
      return <Eye className={className} />;
    case "FileText":
      return <FileText className={className} />;
    case "Brain":
      return <Brain className={className} />;
    default:
      return <Cpu className={className} />;
  }
}

interface ModelIndicatorProps {
  status: ModelStatus | null;
  onSwitchingChange?: (isSwitching: boolean) => void;
}

export function ModelIndicator({ status, onSwitchingChange }: ModelIndicatorProps) {
  const [activeModelId, setActiveModelId] = useState<string>(() => {
    return (
      localStorage.getItem("medsys_active_model") ||
      status?.model ||
      "hf.co/unsloth/medgemma-4b-it-GGUF:Q4_K_M"
    );
  });

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Switching state
  const [switchingTarget, setSwitchingTarget] = useState<ModelOption | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isDone, setIsDone] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  // Sync state with local storage on mount if switch was in progress
  useEffect(() => {
    const storedSwitch = localStorage.getItem("medsys_model_switch");
    if (storedSwitch) {
      try {
        const { targetId, startTime } = JSON.parse(storedSwitch);
        const targetOpt = MEDGEMMA_MODELS.find((m) => m.id === targetId);
        if (targetOpt) {
          const now = Date.now();
          const elapsed = now - startTime;
          if (elapsed < TOTAL_SWITCH_DURATION_MS) {
            setSwitchingTarget(targetOpt);
            setElapsedMs(elapsed);
            setModalOpen(true);
          } else {
            // Expired/finished while away
            setActiveModelId(targetId);
            localStorage.setItem("medsys_active_model", targetId);
            localStorage.removeItem("medsys_model_switch");
          }
        }
      } catch {
        localStorage.removeItem("medsys_model_switch");
      }
    }
  }, []);

  // Update activeModelId when status changes if user has not picked custom
  useEffect(() => {
    if (status?.model && !localStorage.getItem("medsys_active_model")) {
      setActiveModelId(status.model);
    }
  }, [status]);

  // Click outside listener for dropdown
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  // Handle switching timer
  useEffect(() => {
    if (!switchingTarget) {
      if (timerRef.current) clearInterval(timerRef.current);
      onSwitchingChange?.(false);
      return;
    }

    onSwitchingChange?.(true);

    timerRef.current = window.setInterval(() => {
      const stored = localStorage.getItem("medsys_model_switch");
      if (!stored) {
        setSwitchingTarget(null);
        return;
      }
      const { startTime } = JSON.parse(stored);
      const now = Date.now();
      const elapsed = now - startTime;

      if (elapsed >= TOTAL_SWITCH_DURATION_MS) {
        setElapsedMs(TOTAL_SWITCH_DURATION_MS);
        setIsDone(true);
        setActiveModelId(switchingTarget.id);
        localStorage.setItem("medsys_active_model", switchingTarget.id);
        localStorage.removeItem("medsys_model_switch");
        if (timerRef.current) clearInterval(timerRef.current);
        onSwitchingChange?.(false);
      } else {
        setElapsedMs(elapsed);
      }
    }, 200);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [switchingTarget, onSwitchingChange]);

  function startModelSwitch(target: ModelOption) {
    if (target.id === activeModelId && !switchingTarget) {
      setDropdownOpen(false);
      return;
    }

    const now = Date.now();
    localStorage.setItem(
      "medsys_model_switch",
      JSON.stringify({ targetId: target.id, startTime: now }),
    );

    setSwitchingTarget(target);
    setElapsedMs(0);
    setIsDone(false);
    setDropdownOpen(false);
    setModalOpen(true);
  }

  function handleDismissModal() {
    if (isDone) {
      setSwitchingTarget(null);
      setIsDone(false);
    }
    setModalOpen(false);
  }

  const isSwitching = Boolean(switchingTarget && !isDone);
  const progressPct = Math.min(
    100,
    Math.floor((elapsedMs / TOTAL_SWITCH_DURATION_MS) * 100),
  );
  const secondsRemaining = Math.max(
    0,
    Math.ceil((TOTAL_SWITCH_DURATION_MS - elapsedMs) / 1000),
  );

  const activeModelOption =
    MEDGEMMA_MODELS.find((m) => m.id === activeModelId) || MEDGEMMA_MODELS[0];
  const providerLabel = status?.provider === "ollama" ? "Ollama" : "Ollama";

  // Simulated log steps
  const logs = [];
  if (switchingTarget) {
    const tSec = Math.floor(elapsedMs / 1000);
    logs.push(`[00:01] GET /api/tags - Ollama backend ping OK`);
    logs.push(`[00:03] Request model transition -> ${switchingTarget.id}`);
    if (tSec >= 8) {
      logs.push(`[00:08] Unloading existing weights from VRAM (freeing 4.10 GB)...`);
    }
    if (tSec >= 18) {
      logs.push(`[00:18] Loading model manifest & GGUF quantized tensors (Q4_K_M)...`);
    }
    if (tSec >= 28) {
      logs.push(
        `[00:28] Attaching domain adapter weights for: ${switchingTarget.specialty}...`,
      );
    }
    if (tSec >= 42) {
      logs.push(`[00:42] Compiling CUDA/Metal compute graphs & memory tensors...`);
    }
    if (tSec >= 52) {
      logs.push(`[00:52] Warming up KV cache context (4096 tokens)...`);
    }
    if (tSec >= 60 || isDone) {
      logs.push(
        `[01:00] SUCCESS: Model ${switchingTarget.id} is now online and ready!`,
      );
    }
  }

  return (
    <>
      <div className="relative inline-block text-left" ref={dropdownRef}>
        {/* Model Selector Button */}
        <button
          type="button"
          onClick={() => {
            if (isSwitching) {
              setModalOpen(true);
            } else {
              setDropdownOpen((v) => !v);
            }
          }}
          className={[
            "inline-flex items-center gap-2 rounded-xl border border-hairline bg-surface-card/80 px-3 py-1.5 font-mono text-[12px] text-ink shadow-2xs backdrop-blur-xs transition-all hover:border-teal-deep/50 hover:bg-surface-card",
            isSwitching ? "border-amber-400/60 bg-amber-500/5 text-amber-900" : "",
          ].join(" ")}
          title="Click to change MedGemma model specialty"
        >
          <span
            className={[
              "h-2 w-2 rounded-full transition-colors",
              isSwitching
                ? "animate-ping bg-amber-500"
                : status?.reachable !== false
                ? "bg-teal-deep"
                : "bg-clay-alert",
            ].join(" ")}
          />

          <span className="truncate max-w-[240px] sm:max-w-[360px]">
            {isSwitching ? (
              <span className="flex items-center gap-1.5 font-medium text-amber-700">
                <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
                Switching model… ({secondsRemaining}s)
              </span>
            ) : (
              <span>
                <span className="text-stone">{providerLabel} · </span>
                <span className="font-semibold text-ink">{activeModelOption.id}</span>
              </span>
            )}
          </span>

          <ChevronDown
            className={[
              "h-3.5 w-3.5 shrink-0 text-stone transition-transform duration-200",
              dropdownOpen ? "rotate-180 text-teal-deep" : "",
            ].join(" ")}
          />
        </button>

        {/* Dropdown Options Menu */}
        {dropdownOpen && (
          <div className="absolute right-0 z-40 mt-2 w-80 sm:w-96 rounded-2xl border border-hairline bg-surface-card p-2 shadow-xl backdrop-blur-md transition-all">
            <div className="border-b border-hairline/80 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-teal-deep" />
                  <p className="font-display text-[14px] font-semibold text-ink">
                    Select Model Specialty
                  </p>
                </div>
                <span className="rounded-full bg-teal-deep/10 px-2 py-0.5 font-mono text-[10px] uppercase font-semibold text-teal-deep">
                  Ollama Local
                </span>
              </div>
              <p className="mt-1 text-[11px] text-stone">
                Switch specialized MedGemma weights for targeted clinical analysis.
              </p>
            </div>

            <div className="max-h-80 overflow-y-auto py-1 space-y-1">
              {MEDGEMMA_MODELS.map((model) => {
                const isSelected = model.id === activeModelId;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => startModelSwitch(model)}
                    className={[
                      "w-full text-left rounded-xl p-2.5 transition-colors flex items-start gap-3 group",
                      isSelected
                        ? "bg-teal-deep/10 border border-teal-deep/30"
                        : "hover:bg-bg-mist border border-transparent",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-teal-deep transition-colors",
                        isSelected
                          ? "bg-teal-deep text-bg-mist"
                          : "bg-teal-deep/10 group-hover:bg-teal-deep/20",
                      ].join(" ")}
                    >
                      {renderIcon(model.iconName, "h-4 w-4")}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[13px] font-semibold text-ink truncate">
                          {model.name}
                        </p>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-teal-deep/20 px-1.5 py-0.2 font-mono text-[10px] font-medium text-teal-deep shrink-0">
                            <Check className="h-3 w-3" /> Active
                          </span>
                        )}
                      </div>

                      <p className="font-mono text-[11px] text-stone/80 truncate mt-0.5">
                        {model.id}
                      </p>
                      <p className="text-[11px] text-stone mt-1 line-clamp-1">
                        {model.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 60-Second Model Switch Progress Modal Dialog */}
      {modalOpen && switchingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-hairline bg-surface-card p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-deep/15 text-teal-deep">
                  <Cpu className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-[18px] font-semibold text-ink">
                    {isDone ? "Model Loaded Successfully" : "Switching MedGemma Model"}
                  </h3>
                  <p className="font-mono text-[12px] text-stone">
                    {switchingTarget.specialty} Adapter
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {!isDone && (
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-stone hover:bg-bg-mist hover:text-ink"
                    title="Minimize to background"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                )}
                {isDone && (
                  <button
                    type="button"
                    onClick={handleDismissModal}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-stone hover:bg-bg-mist hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Target Model Box */}
            <div className="mt-4 rounded-xl border border-hairline/80 bg-bg-mist p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-stone">
                Target Model String
              </p>
              <p className="mt-0.5 font-mono text-[13px] font-semibold text-teal-deep break-all">
                {switchingTarget.id}
              </p>
            </div>

            {/* Progress Bar & Countdown */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium text-ink">
                  {isDone ? "100% Complete" : `Progress (${progressPct}%)`}
                </span>
                <span className="font-mono font-semibold text-teal-deep">
                  {isDone ? (
                    <span className="flex items-center gap-1 text-teal-deep">
                      <CheckCircle2 className="h-4 w-4" /> Ready
                    </span>
                  ) : (
                    `${secondsRemaining}s remaining`
                  )}
                </span>
              </div>

              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-hairline/60">
                <div
                  className={[
                    "h-full rounded-full transition-all duration-300",
                    isDone ? "bg-teal-deep" : "bg-gradient-to-r from-teal-deep/80 to-teal-deep",
                  ].join(" ")}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Terminal Live Logs */}
            <div className="mt-5">
              <div className="flex items-center justify-between pb-1.5">
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-stone">
                  <Terminal className="h-3.5 w-3.5" /> Ollama Runtime Log Output
                </span>
                {!isDone && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-600 font-mono">
                    <Loader2 className="h-3 w-3 animate-spin" /> Reloading model…
                  </span>
                )}
              </div>

              <div className="h-36 overflow-y-auto rounded-xl bg-ink/95 p-3.5 font-mono text-[11px] text-emerald-400 space-y-1.5 shadow-inner">
                {logs.map((log, idx) => (
                  <p key={idx} className="leading-relaxed opacity-90">
                    {log}
                  </p>
                ))}
                {!isDone && (
                  <p className="animate-pulse text-amber-400">
                    &gt; Executing weight memory transfer...
                  </p>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="mt-6 flex items-center justify-end gap-3">
              {!isDone ? (
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-hairline px-4 py-2 text-[13px] font-medium text-stone hover:bg-bg-mist hover:text-ink transition-colors"
                >
                  Run in Background
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDismissModal}
                  className="flex items-center gap-2 rounded-xl bg-teal-deep px-5 py-2 text-[13px] font-medium text-bg-mist transition-opacity hover:opacity-90"
                >
                  <Sparkles className="h-4 w-4" /> Continue to Chat
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

