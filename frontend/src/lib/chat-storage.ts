import { Conversation } from "@/lib/types";
import { DEFAULT_MODEL } from "@/lib/models";

const STORAGE_KEY = "chatgpt-clone-v1";

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

export function createConversation(model: string = DEFAULT_MODEL): Conversation {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    model,
    messages: [],
  };
}

export function truncateTitle(text: string, max = 42): string {
  const firstLine = text.trim().split(/\r?\n/)[0] ?? "";
  const trimmed = firstLine.replace(/\s+/g, " ");
  if (!trimmed) return "New chat";
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}
