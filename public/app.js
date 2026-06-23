const socket = io();

const loginModal = document.getElementById("loginModal");
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("usernameInput");

const channelsContainer = document.getElementById("channels");
const createChannelForm = document.getElementById("createChannelForm");
const channelInput = document.getElementById("channelInput");

const channelTitle = document.getElementById("channelTitle");
const statusText = document.getElementById("statusText");
const messagesEl = document.getElementById("messages");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const emojiToggleButton = document.getElementById("emojiToggleButton");
const emojiPicker = document.getElementById("emojiPicker");
const clearMessagesButton = document.getElementById("clearMessagesButton");

const membersList = document.getElementById("membersList");

const DEFAULT_AVATAR_URL = "/assets/default-avatar.svg";
const QUICK_EMOJIS = ["😀", "😂", "😎", "🥶", "🔥", "❤️", "👍", "🎉", "🤝", "😴"];

let currentUser = null;
let currentChannel = null;
let channels = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setConnectedState(connected) {
  statusText.textContent = connected ? "Conectado" : "Desconectado";
}

function toggleMessageComposer(enabled) {
  messageInput.disabled = !enabled;
  sendButton.disabled = !enabled;
  emojiToggleButton.disabled = !enabled;
  if (!enabled) {
    emojiPicker.classList.add("hidden");
  }
}

function avatarImg(avatarUrl, username) {
  const safeUsername = escapeHtml(username);
  return `<img class="avatar" src="${escapeHtml(avatarUrl || DEFAULT_AVATAR_URL)}" alt="Avatar de ${safeUsername}" />`;
}

function normalizeMember(member) {
  if (typeof member === "string") {
    return { username: member, avatarUrl: DEFAULT_AVATAR_URL };
  }
  return {
    username: member?.username || "usuario",
    avatarUrl: member?.avatarUrl || DEFAULT_AVATAR_URL,
  };
}

function normalizeMessage(message) {
  return {
    id: message?.id,
    channelName: message?.channelName || currentChannel,
    username: message?.username || "usuario",
    avatarUrl: message?.avatarUrl || DEFAULT_AVATAR_URL,
    text: message?.text || "",
    createdAt: message?.createdAt || new Date().toISOString(),
  };
}

function renderMembers(members) {
  membersList.innerHTML = "";
  if (!members.length) return;
  members.forEach((member) => {
    const normalized = normalizeMember(member);
    const li = document.createElement("li");
    li.className = "member-item";
    li.innerHTML = `
      ${avatarImg(normalized.avatarUrl, normalized.username)}
      <span>${escapeHtml(normalized.username)}</span>
    `;
    membersList.appendChild(li);
  });
}

function appendMessage(message) {
  const normalized = normalizeMessage(message);
  const article = document.createElement("article");
  article.className = "message";
  const createdAt = new Date(normalized.createdAt);
  const time = createdAt.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const safeUsername = escapeHtml(normalized.username);
  article.innerHTML = `
    <div class="message-header">
      ${avatarImg(normalized.avatarUrl, normalized.username)}
      <strong>${safeUsername}</strong>
      <small>${time}</small>
    </div>
    <div>${escapeHtml(normalized.text)}</div>
  `;
  messagesEl.appendChild(article);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderMessages(messages) {
  messagesEl.innerHTML = "";
  messages.forEach(appendMessage);
}

function renderChannels() {
  channelsContainer.innerHTML = "";
  channels.forEach((channel) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "channel-item";
    button.classList.toggle("active", channel.name === currentChannel);
    button.innerHTML = `
      <span># ${escapeHtml(channel.name)}</span>
      <small>${channel.membersCount}</small>
    `;
    button.addEventListener("click", () => {
      joinChannel(channel.name);
    });
    channelsContainer.appendChild(button);
  });
}

function joinChannel(channelName) {
  socket.emit("join-channel", channelName, (result) => {
    if (!result?.ok) {
      alert(result?.message || "No se pudo entrar al canal.");
      return;
    }

    currentChannel = result.channelName;
    channelTitle.textContent = `# ${currentChannel}`;
    toggleMessageComposer(true);
    renderMessages(result.messages || []);
    renderMembers(result.members || []);
    renderChannels();
  });
}

function insertEmoji(emoji) {
  const start = messageInput.selectionStart ?? messageInput.value.length;
  const end = messageInput.selectionEnd ?? messageInput.value.length;
  const current = messageInput.value;
  messageInput.value = current.slice(0, start) + emoji + current.slice(end);
  const nextCursor = start + emoji.length;
  messageInput.setSelectionRange(nextCursor, nextCursor);
  messageInput.focus();
}

function setupEmojiPicker() {
  QUICK_EMOJIS.forEach((emoji) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "emoji-button";
    button.textContent = emoji;
    button.addEventListener("click", () => {
      insertEmoji(emoji);
    });
    emojiPicker.appendChild(button);
  });
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const username = usernameInput.value.trim();
  if (!username) return;

  socket.emit("set-username", username, (result) => {
    if (!result?.ok) {
      alert(result?.message || "Usuario inválido.");
      return;
    }
    currentUser = result.username;
    loginModal.style.display = "none";
    joinChannel("general");
  });
});

createChannelForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = channelInput.value.trim();
  if (!name) return;

  socket.emit("create-channel", name, (result) => {
    if (!result?.ok) {
      alert(result?.message || "No se pudo crear el canal.");
      return;
    }
    channelInput.value = "";
    joinChannel(result.channelName);
  });
});

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !currentChannel) return;

  socket.emit("chat-message", text, (result) => {
    if (!result?.ok) {
      alert(result?.message || "No se pudo enviar.");
      return;
    }
    messageInput.value = "";
    messageInput.focus();
  });
});

emojiToggleButton.addEventListener("click", () => {
  if (emojiToggleButton.disabled) return;
  emojiPicker.classList.toggle("hidden");
});

clearMessagesButton.addEventListener("click", () => {
  socket.emit("clear-all-messages", (result) => {
    if (!result?.ok) {
      alert(result?.message || "No se pudieron limpiar los mensajes.");
      return;
    }
    renderMessages([]);
  });
});

socket.on("connect", () => {
  setConnectedState(true);
});

socket.on("disconnect", () => {
  setConnectedState(false);
});

socket.on("channels-updated", (newChannels) => {
  channels = newChannels;
  renderChannels();
});

socket.on("members-updated", ({ channelName, members }) => {
  if (channelName !== currentChannel) return;
  renderMembers(members);
});

socket.on("new-message", (message) => {
  if (message.channelName !== currentChannel) return;
  appendMessage(message);
});

socket.on("messages-cleared", () => {
  renderMessages([]);
});

setupEmojiPicker();
toggleMessageComposer(false);
setConnectedState(false);
