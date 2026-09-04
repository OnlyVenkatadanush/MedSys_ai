import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Paperclip, ArrowUp, Globe, Mic, Square, Loader2, Image as ImageIcon, X } from "lucide-react";
import { transcribeAudio } from "@/services/chat";
import { SourcePicker } from "./SourcePicker";
import type { ChatSource } from "@/types";

interface ComposerProps {
  onSend: (content: string, deepSearch: boolean, images?: string[]) => void;
  availableSources: ChatSource[];
  selectedSourceIds: string[];
  onToggleSource: (id: string) => void;
  disabled?: boolean;
}

const ADAPTER_TAGS = [
  { tag: "@radiology", label: "Radiology", icon: "🩻" },
  { tag: "@dermatology", label: "Dermatology", icon: "✨" },
  { tag: "@pathology", label: "Pathology", icon: "🔬" },
  { tag: "@ophthalmology", label: "Ophthalmology", icon: "👁️" },
  { tag: "@chest_xray", label: "Chest X-Ray", icon: "🫁" },
  { tag: "@cardiology", label: "Cardiology", icon: "❤️" },
  { tag: "@clinical_reasoning", label: "Reasoning", icon: "🧠" },
];

export function Composer({
  onSend,
  availableSources,
  selectedSourceIds,
  onToggleSource,
  disabled,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deepSearch, setDeepSearch] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedImageName, setAttachedImageName] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function insertAdapterTag(tag: string) {
    const clean = value.replace(/@[a-zA-Z0-9_]+\s*/g, "").trim();
    setValue(`${tag} ${clean}`.trim() + (clean ? "" : " "));
  }

  useEffect(() => {
    if (!pickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedImageName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        // Strip data:image/...;base64, prefix for Ollama payload compatibility
        const base64Data = result.includes(",") ? result.split(",")[1] : result;
        setAttachedImage(base64Data);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if ((!trimmed && !attachedImage) || disabled) return;
    const finalContent = trimmed || (attachedImageName ? `[Attached Image: ${attachedImageName}]` : "Analyze this image");
    onSend(finalContent, deepSearch, attachedImage ? [attachedImage] : undefined);
    setValue("");
    setAttachedImage(null);
    setAttachedImageName(null);
    setDeepSearch(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleMicClick() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setTranscribing(true);
        try {
          const text = await transcribeAudio(blob);
          setValue((prev) => (prev ? `${prev} ${text}` : text));
        } catch {
          setMicError("Couldn't transcribe that — try again.");
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setMicError("Microphone access was denied.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {micError && <p className="text-[12px] text-clay-alert">{micError}</p>}

      {/* Quick Adapter Tags Bar */}
      <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-0.5 text-xs text-stone-600">
        <span className="font-mono text-[10px] font-bold tracking-wider text-stone-600 uppercase mr-1">
          Adapters:
        </span>
        {ADAPTER_TAGS.map(({ tag, label, icon }) => {
          const isSelected = value.toLowerCase().includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => insertAdapterTag(tag)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                isSelected
                  ? "border-teal-600 bg-teal-50 text-teal-900 font-semibold"
                  : "border-stone-200 bg-white/80 text-stone-600 hover:border-stone-300 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Image Preview Attachment Badge */}
      {attachedImage && (
        <div className="flex items-center gap-2 self-start rounded-xl border border-teal-deep/30 bg-teal-deep/10 px-3 py-1.5 font-mono text-[12px] text-teal-deep shadow-2xs">
          <ImageIcon className="h-4 w-4 shrink-0" />
          <span className="truncate max-w-[200px] font-medium">{attachedImageName || "Attached Image"}</span>
          <button
            type="button"
            onClick={() => {
              setAttachedImage(null);
              setAttachedImageName(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-stone-500 hover:bg-stone-200 hover:text-stone-900"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Floating Pill Input Bar */}
      <div className="flex items-center gap-2.5 rounded-full border border-stone-300/90 bg-white/95 backdrop-blur-md px-4 py-2 shadow-md transition-colors focus-within:border-stone-800">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Paperclip Source Picker */}
        <div className="relative shrink-0" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
            aria-label="Choose documents to ground this chat on"
            className={[
              "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
              selectedSourceIds.length > 0
                ? "bg-[#191c24] text-white"
                : "text-stone-500 hover:bg-stone-100 hover:text-stone-900",
            ].join(" ")}
          >
            <Paperclip className="h-4 w-4" strokeWidth={2} />
          </button>
          {pickerOpen && (
            <SourcePicker
              sources={availableSources}
              selectedIds={selectedSourceIds}
              onToggle={onToggleSource}
            />
          )}
        </div>

        {/* Deep Search Toggle */}
        <button
          type="button"
          onClick={() => setDeepSearch((v) => !v)}
          aria-pressed={deepSearch}
          title="Deep search — search and read the web for this question"
          className={[
            "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer",
            deepSearch
              ? "bg-[#191c24] text-white border-stone-800"
              : "bg-stone-100/90 text-stone-700 border-stone-300/80 hover:bg-stone-200/80",
          ].join(" ")}
        >
          <Globe className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">Deep search</span>
        </button>

        {/* Image Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach medical scan / image"
          className={[
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
            attachedImage
              ? "bg-[#191c24] text-white"
              : "text-stone-500 hover:bg-stone-100 hover:text-stone-900",
          ].join(" ")}
        >
          <ImageIcon className="h-4 w-4" strokeWidth={1.75} />
        </button>

        {/* Text Input */}
        <textarea
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder={
            transcribing
              ? "Transcribing voice…"
              : attachedImage
              ? "Ask a question about this image..."
              : "Ask about your symptoms, vitals, or reports..."
          }
          disabled={transcribing}
          className="max-h-24 flex-1 resize-none bg-transparent py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none disabled:opacity-60 font-sans"
        />

        {/* Voice Recording Button */}
        <button
          type="button"
          onClick={handleMicClick}
          disabled={transcribing}
          aria-pressed={recording}
          aria-label={recording ? "Stop recording" : "Record voice message"}
          className={[
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50",
            recording
              ? "animate-pulse bg-red-600 text-white"
              : "text-stone-500 hover:bg-stone-100 hover:text-stone-900",
          ].join(" ")}
        >
          {transcribing ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : recording ? (
            <Square className="h-3.5 w-3.5" strokeWidth={2} fill="currentColor" />
          ) : (
            <Mic className="h-4 w-4" strokeWidth={2} />
          )}
        </button>

        {/* Send Button */}
        <button
          type="submit"
          disabled={(!value.trim() && !attachedImage) || disabled}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#191c24] text-white transition-opacity hover:bg-[#2c313d] disabled:opacity-30 shadow-xs"
          aria-label="Send message"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2.2} />
        </button>
      </div>
    </form>
  );
}

