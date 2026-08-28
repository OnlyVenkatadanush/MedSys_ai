import { Stethoscope, ClipboardPlus, Pill, FileText, Globe, FileCheck, Cpu } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ChatSourceKind } from "@/types";

export const KIND_ICON: Record<ChatSourceKind, LucideIcon> = {
  consultation: Stethoscope,
  consult_prescription: ClipboardPlus,
  prescription: Pill,
  report: FileText,
  web: Globe,
  doc: FileCheck,
  system: Cpu,
};

export const KIND_LABEL: Record<ChatSourceKind, string> = {
  consultation: "Consultation",
  consult_prescription: "Consult + Prescription",
  prescription: "Prescription",
  report: "Report",
  web: "Search result",
  doc: "Document",
  system: "System Assistant",
};
