"use client";

import { Conversation } from "@/lib/types";
import { getModelLabel } from "@/lib/models";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-white/10 bg-[#171717]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
        <h1 className="text-sm font-semibold text-white">Chats</h1>
        <button
          type="button"
          onClick={onNewChat}
          title="New chat"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-lg text-white transition hover:bg-white/5"
        >
          +
        </button>
      </div>

      <ul className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-zinc-500">
            No conversations yet
          </li>
        ) : (
          conversations.map((conversation) => {
            const isActive = conversation.id === activeId;

            return (
              <li key={conversation.id} className="group mb-1 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  className={`min-w-0 flex-1 rounded-lg px-3 py-2.5 text-left transition ${
                    isActive
                      ? "bg-[#2f2f2f] text-white"
                      : "text-zinc-300 hover:bg-white/5"
                  }`}
                >
                  <span className="block truncate text-sm">{conversation.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-zinc-500">
                    {getModelLabel(conversation.model)} · {formatTime(conversation.updatedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  title="Delete chat"
                  onClick={() => onDelete(conversation.id)}
                  className="rounded-md px-2 py-1 text-sm text-zinc-500 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
                >
                  ×
                </button>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}
