import type { ChatMessage, ChatSession, ChatSource, ChatSourceDetail, ModelStatus } from "@/types";
import { apiFetch, apiUpload, isMockMode, mockDelay } from "./client";
import {
  mockChatMessages,
  mockChatSessions,
  mockChatSources,
  mockModelStatus,
} from "./mocks";

export async function getModelStatus(): Promise<ModelStatus> {
  if (isMockMode) return mockDelay(mockModelStatus, 200);
  return apiFetch<ModelStatus>("/health");
}

export async function getChatSources(): Promise<ChatSource[]> {
  if (isMockMode) return mockDelay(mockChatSources);
  return apiFetch<ChatSource[]>("/chat/sources");
}

export async function getSourceContent(source: ChatSource): Promise<ChatSourceDetail> {
  if (isMockMode) return mockDelay({ ...source, content: source.excerpt }, 300);
  return apiFetch<ChatSourceDetail>(`/chat/sources/${encodeURIComponent(source.id)}/content`);
}

export async function listChatSessions(): Promise<ChatSession[]> {
  if (isMockMode) return mockDelay(mockChatSessions);
  return apiFetch<ChatSession[]>("/chat/sessions");
}

export async function createChatSession(): Promise<ChatSession> {
  if (isMockMode) {
    const now = new Date().toISOString();
    return mockDelay(
      { id: `local-${Date.now()}`, title: "New chat", createdAt: now, updatedAt: now, sourceIds: [] },
      250,
    );
  }
  return apiFetch<ChatSession>("/chat/sessions", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function setSessionSources(
  sessionId: string,
  sourceIds: string[],
): Promise<ChatSession> {
  if (isMockMode) {
    const now = new Date().toISOString();
    return mockDelay({ id: sessionId, title: "New chat", createdAt: now, updatedAt: now, sourceIds }, 150);
  }
  return apiFetch<ChatSession>(`/chat/sessions/${sessionId}/sources`, {
    method: "PUT",
    body: JSON.stringify({ sourceIds }),
  });
}

export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  if (isMockMode) {
    return mockDelay(sessionId === "sess-1" ? mockChatMessages : []);
  }
  return apiFetch<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`);
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  if (isMockMode) return mockDelay(undefined as unknown as void, 150);
  await apiFetch<void>(`/chat/sessions/${sessionId}`, { method: "DELETE" });
}

export async function deleteChatSource(sourceId: string): Promise<void> {
  if (isMockMode) return mockDelay(undefined as unknown as void, 150);
  await apiFetch<void>(`/chat/sources/${encodeURIComponent(sourceId)}`, { method: "DELETE" });
}

export async function sendSessionMessage(
  sessionId: string,
  content: string,
  deepSearch = false,
  images?: string[],
): Promise<ChatMessage> {
  if (isMockMode) {
    return mockDelay(
      {
        id: `m-${Date.now()}`,
        role: "assistant",
        content: deepSearch
          ? "This is a mock deep-search response — connect VITE_API_BASE_URL to a running backend to actually search and scrape the web."
          : "This is a mock response — connect VITE_API_BASE_URL to a running MedSys AI backend to get grounded answers from your uploaded reports.",
        createdAt: new Date().toISOString(),
      },
      700,
    );
  }
  return apiFetch<ChatMessage>(`/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, deepSearch, images }),
  });
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  if (isMockMode) {
    return mockDelay(
      "This is a mock transcript — connect VITE_API_BASE_URL to a running backend for real speech-to-text.",
      600,
    );
  }
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");
  const { text } = await apiUpload<{ text: string }>("/chat/transcribe", formData);
  return text;
}
