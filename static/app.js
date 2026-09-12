const API_BASE = "";
const STORAGE_KEY = "chat-history-v1";

const chatListEl = document.getElementById("chat-list");
const messagesEl = document.getElementById("messages");
const chatTitleEl = document.getElementById("chat-title");
const chatFormEl = document.getElementById("chat-form");
const messageInputEl = document.getElementById("message-input");
const sendBtnEl = document.getElementById("send-btn");
const newChatBtnEl = document.getElementById("new-chat-btn");

let chats = loadChats();
let activeChatId = chats[0]?.id ?? null;
let isSending = false;

function loadChats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveChats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

function createChat() {
  const chat = {
    id: crypto.randomUUID(),
    title: "New chat",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
  chats.unshift(chat);
  activeChatId = chat.id;
  saveChats();
  render();
  return chat;
}

function getActiveChat() {
  return chats.find((chat) => chat.id === activeChatId) ?? null;
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncate(text, max = 42) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function renderChatList() {
  chatListEl.innerHTML = "";

  if (chats.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No chats yet";
    chatListEl.appendChild(empty);
    return;
  }

  for (const chat of chats) {
    const item = document.createElement("li");
    item.className = `chat-item${chat.id === activeChatId ? " active" : ""}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "chat-item-btn";
    button.innerHTML = `
      <span class="chat-item-title">${escapeHtml(chat.title)}</span>
      <span class="chat-item-meta">${formatTime(chat.updatedAt)}</span>
    `;
    button.addEventListener("click", () => {
      activeChatId = chat.id;
      render();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "chat-item-delete";
    deleteBtn.title = "Delete chat";
    deleteBtn.textContent = "×";
    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteChat(chat.id);
    });

    item.append(button, deleteBtn);
    chatListEl.appendChild(item);
  }
}

function renderMessages() {
  messagesEl.innerHTML = "";
  const chat = getActiveChat();

  if (!chat) {
    messagesEl.innerHTML = `<div class="empty-state">Start a new chat to begin.</div>`;
    chatTitleEl.textContent = "New chat";
    return;
  }

  chatTitleEl.textContent = chat.title;

  if (chat.messages.length === 0 && !isSending) {
    messagesEl.innerHTML = `<div class="empty-state">Ask anything to start the conversation.</div>`;
    return;
  }

  for (const message of chat.messages) {
    messagesEl.appendChild(createMessageElement(message.role, message.content));
  }

  if (isSending) {
    messagesEl.appendChild(createThinkingElement());
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function createMessageElement(role, content) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "You" : "Assistant";

  const body = document.createElement("div");
  body.textContent = content;

  wrapper.append(label, body);
  return wrapper;
}

function createThinkingElement() {
  const wrapper = document.createElement("div");
  wrapper.className = "message assistant";
  wrapper.innerHTML = `
    <span class="message-label">Assistant</span>
    <div class="thinking">
      <span>Thinking</span>
      <span class="thinking-dots" aria-hidden="true">
        <span></span><span></span><span></span>
      </span>
    </div>
  `;
  return wrapper;
}

function renderComposerState() {
  sendBtnEl.disabled = isSending || !messageInputEl.value.trim();
  messageInputEl.disabled = isSending;
}

function render() {
  renderChatList();
  renderMessages();
  renderComposerState();
}

function deleteChat(chatId) {
  chats = chats.filter((chat) => chat.id !== chatId);
  if (activeChatId === chatId) {
    activeChatId = chats[0]?.id ?? null;
  }
  saveChats();
  render();
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendMessage(text) {
  let chat = getActiveChat();
  if (!chat) {
    chat = createChat();
  }

  chat.messages.push({ role: "user", content: text });
  if (chat.messages.length === 1) {
    chat.title = truncate(text);
  }
  chat.updatedAt = Date.now();
  saveChats();

  isSending = true;
  render();

  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_message: text }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(errorBody || `Request failed (${response.status})`);
    }

    const data = await response.json();
    chat.messages.push({ role: "assistant", content: data.content || "" });
  } catch (error) {
    chat.messages.push({
      role: "assistant",
      content: `Sorry, something went wrong: ${error.message}`,
    });
  } finally {
    chat.updatedAt = Date.now();
    isSending = false;
    saveChats();
    render();
  }
}

chatFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = messageInputEl.value.trim();
  if (!text || isSending) return;

  messageInputEl.value = "";
  renderComposerState();
  await sendMessage(text);
});

messageInputEl.addEventListener("input", () => {
  messageInputEl.style.height = "auto";
  messageInputEl.style.height = `${Math.min(messageInputEl.scrollHeight, 160)}px`;
  renderComposerState();
});

messageInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatFormEl.requestSubmit();
  }
});

newChatBtnEl.addEventListener("click", () => {
  createChat();
  messageInputEl.focus();
});

if (chats.length === 0) {
  createChat();
} else {
  render();
}
