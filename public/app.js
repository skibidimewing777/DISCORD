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

const membersList = document.getElementById("membersList");

let currentUser = null;
let currentChannel = null;
let channels = [];

function escapeHtml(value) {
  return value
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
}

function renderMembers(members) {
  membersList.innerHTML = "";
  if (!members.length) return;
  members.forEach((member) => {
    const li = document.createElement("li");
    li.textContent = member;
    membersList.appendChild(li);
  });
}

function appendMessage(message) {
  const article = document.createElement("article");
  article.className = "message";
  const createdAt = new Date(message.createdAt);
  const time = createdAt.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  article.innerHTML = `
    <div class="message-header">
      <strong class="${message.username === "system" ? "system" : ""}">
        ${escapeHtml(message.username)}
      </strong>
      <small>${time}</small>
    </div>
    <div>${escapeHtml(message.text)}</div>
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
    renderMessages(result.messages || []);
    renderMembers(result.members || []);
    toggleMessageComposer(true);
    renderChannels();
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

toggleMessageComposer(false);
setConnectedState(false);
