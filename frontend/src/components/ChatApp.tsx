"use client";

import { useCallback, useEffect, useState } from "react";
import { Conversation } from "@/lib/types";
import { DEFAULT_MODEL } from "@/lib/models";
import {
  createConversation,
  loadConversations,
  saveConversations,
  truncateTitle,
} from "@/lib/chat-storage";
import { Sidebar } from "@/components/Sidebar";
import { ChatPanel } from "@/components/ChatPanel";

export function ChatApp() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadConversations();
    setConversations(stored);
    setActiveId(stored[0]?.id ?? null);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveConversations(conversations);
  }, [conversations, hydrated]);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) ?? null;

  const updateConversation = useCallback(
    (id: string, updater: (conversation: Conversation) => Conversation) => {
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === id ? updater(conversation) : conversation,
        ),
      );
    },
    [],
  );

  function handleNewChat() {
    const conversation = createConversation(DEFAULT_MODEL);
    setConversations((current) => [conversation, ...current]);
    setActiveId(conversation.id);
  }

  function handleDelete(id: string) {
    setConversations((current) => {
      const next = current.filter((conversation) => conversation.id !== id);
      setActiveId((currentActive) => {
        if (currentActive !== id) return currentActive;
        return next[0]?.id ?? null;
      });
      return next;
    });
  }

  function handleModelChange(model: string) {
    if (!activeId) return;
    updateConversation(activeId, (conversation) => ({
      ...conversation,
      model,
      updatedAt: Date.now(),
    }));
  }

  async function generateTitle(conversationId: string, firstMessage: string) {
    try {
      const response = await fetch("/api/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: firstMessage }),
      });

      if (!response.ok) return;

      const data = (await response.json()) as { title?: string };
      if (!data.title) return;

      updateConversation(conversationId, (conversation) => {
        if (conversation.messages.length === 0) return conversation;
        return {
          ...conversation,
          title: data.title!,
          updatedAt: Date.now(),
        };
      });
    } catch {
      // Keep the truncated fallback title if generation fails.
    }
  }

  async function handleSend(text: string) {
    let conversationId = activeId;
    let conversation = activeConversation;

    if (!conversation) {
      const created = createConversation(DEFAULT_MODEL);
      setConversations((current) => [created, ...current]);
      setActiveId(created.id);
      conversationId = created.id;
      conversation = created;
    }

    if (!conversationId || !conversation) return;

    const userMessage = { role: "user" as const, content: text };
    const nextMessages = [...conversation.messages, userMessage];
    const isFirstMessage = conversation.messages.length === 0;

    updateConversation(conversationId, (current) => ({
      ...current,
      title: isFirstMessage ? truncateTitle(text) : current.title,
      updatedAt: Date.now(),
      messages: nextMessages,
    }));

    if (isFirstMessage) {
      void generateTitle(conversationId, text);
    }

    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: conversation.model,
          messages: nextMessages,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error ?? `Request failed (${response.status})`);
      }

      if (!response.body) {
        throw new Error("No response stream received.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      updateConversation(conversationId, (current) => ({
        ...current,
        messages: [...current.messages, { role: "assistant", content: "" }],
      }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === "[DONE]") continue;

          const parsed = JSON.parse(payload) as {
            content?: string;
            error?: string;
          };

          if (parsed.error) {
            throw new Error(parsed.error);
          }

          if (parsed.content) {
            assistantContent += parsed.content;
            const contentSnapshot = assistantContent;

            updateConversation(conversationId, (current) => {
              const messages = [...current.messages];
              const lastIndex = messages.length - 1;
              if (lastIndex >= 0 && messages[lastIndex].role === "assistant") {
                messages[lastIndex] = {
                  role: "assistant",
                  content: contentSnapshot,
                };
              }
              return {
                ...current,
                updatedAt: Date.now(),
                messages,
              };
            });
          }
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong.";

      updateConversation(conversationId, (current) => {
        const messages = [...current.messages];
        const last = messages.at(-1);

        if (last?.role === "assistant" && !last.content) {
          messages[messages.length - 1] = {
            role: "assistant",
            content: `Sorry, something went wrong: ${message}`,
          };
        } else {
          messages.push({
            role: "assistant",
            content: `Sorry, something went wrong: ${message}`,
          });
        }

        return {
          ...current,
          updatedAt: Date.now(),
          messages,
        };
      });
    } finally {
      setIsSending(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#212121] text-sm text-zinc-500">
        Loading conversations...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNewChat={handleNewChat}
        onDelete={handleDelete}
      />
      <ChatPanel
        conversation={activeConversation}
        isSending={isSending}
        onSend={handleSend}
        onModelChange={handleModelChange}
      />
    </div>
  );
}
