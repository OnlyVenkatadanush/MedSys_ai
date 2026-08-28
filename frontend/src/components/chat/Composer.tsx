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
            className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-stone hover:bg-teal-deep/20 hover:text-ink"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 rounded-2xl border border-hairline bg-surface-card p-2 pl-3 focus-within:border-teal-deep">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach an image (X-Ray, CT, skin lesion, medical scan) for MedGemma vision analysis"
          className={[
            "mb-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
            attachedImage
              ? "bg-teal-deep/20 text-teal-deep"
              : "text-stone hover:bg-bg-mist hover:text-ink",
          ].join(" ")}
        >
          <ImageIcon className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
            aria-label="Choose documents to ground this chat on"
            className={[
              "mb-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
              selectedSourceIds.length > 0
                ? "bg-teal-deep/15 text-teal-deep"
                : "text-stone hover:bg-bg-mist hover:text-ink",
            ].join(" ")}
          >
            <Paperclip className="h-4 w-4" strokeWidth={1.75} />
          </button>
          {pickerOpen && (
            <SourcePicker
              sources={availableSources}
              selectedIds={selectedSourceIds}
              onToggle={onToggleSource}
            />
          )}
        </div>

        <button
          type="button"
          onClick={() => setDeepSearch((v) => !v)}
          aria-pressed={deepSearch}
          title="Deep search — search and read the web for this question"
          className={[
            "mb-1.5 flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12px] transition-colors duration-150",
            deepSearch
              ? "bg-teal-deep text-bg-mist"
              : "text-stone hover:bg-bg-mist hover:text-ink",
          ].join(" ")}
        >
          <Globe className="h-4 w-4" strokeWidth={1.75} />
          <span className="hidden sm:inline">Deep search</span>
        </button>

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
              ? "Transcribing…"
              : attachedImage
              ? "Ask a question about this image..."
              : "Ask about your symptoms, vitals, or reports…"
          }
          disabled={transcribing}
          className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-[14px] text-ink placeholder:text-stone/70 focus:outline-none disabled:opacity-60"
        />

        <button
          type="button"
          onClick={handleMicClick}
          disabled={transcribing}
          aria-pressed={recording}
          aria-label={recording ? "Stop recording" : "Record a voice message"}
          className={[
            "mb-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 disabled:opacity-50",
            recording
              ? "animate-pulse bg-clay-alert text-bg-mist"
              : "text-stone hover:bg-bg-mist hover:text-ink",
          ].join(" ")}
        >
          {transcribing ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
          ) : recording ? (
            <Square className="h-3.5 w-3.5" strokeWidth={1.75} fill="currentColor" />
          ) : (
            <Mic className="h-4 w-4" strokeWidth={1.75} />
          )}
        </button>

        <button
          type="submit"
          disabled={(!value.trim() && !attachedImage) || disabled}
          className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-deep text-bg-mist transition-opacity disabled:opacity-30"
          aria-label="Send message"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </form>
  );
}
