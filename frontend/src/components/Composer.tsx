"use client";

import { FormEvent, KeyboardEvent, useRef } from "react";

interface ComposerProps {
  disabled: boolean;
  onSend: (text: string) => void;
}

const MIN_HEIGHT = 72;
const MAX_HEIGHT = 200;

export function Composer({ disabled, onSend }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function resizeTextarea() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const textarea = textareaRef.current;
    if (!textarea) return;

    const text = textarea.value.trim();
    if (!text || disabled) return;

    textarea.value = "";
    textarea.style.height = `${MIN_HEIGHT}px`;
    onSend(text);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
      return;
    }

    if (event.key === "Enter" && event.shiftKey) {
      requestAnimationFrame(resizeTextarea);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-white/10 bg-[#212121] px-4 py-4"
    >
      <div className="mx-auto flex max-w-3xl items-end gap-3 rounded-2xl border border-white/10 bg-[#2f2f2f] px-4 py-3 shadow-lg">
        <textarea
          ref={textareaRef}
          rows={3}
          disabled={disabled}
          placeholder="Message Grok..."
          onInput={resizeTextarea}
          onKeyDown={handleKeyDown}
          style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
          className="flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-white outline-none placeholder:text-zinc-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-zinc-500">
        Enter to send · Shift+Enter for new line
      </p>
    </form>
  );
}
