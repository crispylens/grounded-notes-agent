"use client";

import { useEffect, useRef } from "react";
import { Conversation } from "@/lib/types";
import { MODELS, getModelLabel } from "@/lib/models";
import { MessageBubble } from "@/components/MessageBubble";
import { Composer } from "@/components/Composer";

interface ChatPanelProps {
  conversation: Conversation | null;
  isSending: boolean;
  onSend: (text: string) => void;
  onModelChange: (model: string) => void;
}

export function ChatPanel({
  conversation,
  isSending,
  onSend,
  onModelChange,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages, isSending]);

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-[#212121]">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div>
          <h2 className="text-sm font-medium text-white">
            {conversation?.title ?? "New chat"}
          </h2>
          {conversation && (
            <p className="text-xs text-zinc-500">
              {getModelLabel(conversation.model)}
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 text-xs text-zinc-400">
          Model
          <select
            value={conversation?.model ?? MODELS[0].id}
            disabled={!conversation || isSending}
            onChange={(event) => onModelChange(event.target.value)}
            className="rounded-lg border border-white/10 bg-[#2f2f2f] px-2 py-1.5 text-sm text-white outline-none focus:border-white/20 disabled:opacity-50"
          >
            {MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="flex-1 overflow-y-auto py-4">
        {!conversation ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Start a new chat to begin.
          </div>
        ) : conversation.messages.length === 0 && !isSending ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-lg font-medium text-white">
              How can I help you today?
            </p>
            <p className="max-w-md text-sm text-zinc-500">
              Ask anything. Responses stream from{" "}
              {getModelLabel(conversation.model)} via the AI Builders API.
            </p>
          </div>
        ) : (
          <>
            {conversation.messages.map((message, index) => (
              <MessageBubble key={`${message.role}-${index}`} message={message} />
            ))}
            {isSending &&
              conversation.messages.at(-1)?.role === "user" && (
                <MessageBubble message={{ role: "assistant", content: "" }} />
              )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <Composer disabled={!conversation || isSending} onSend={onSend} />
    </section>
  );
}
