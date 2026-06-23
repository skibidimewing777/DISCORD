const path = require("path");
const express = require("express");
const { randomUUID } = require("crypto");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3000;
const MAX_MESSAGES_PER_CHANNEL = 200;
const DEFAULT_CHANNEL = "general";
const DEFAULT_AVATAR_URL = "/assets/default-avatar.svg";

const usersBySocketId = new Map();
const channels = new Map();

function normalizeChannelName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .slice(0, 32);
}

function ensureChannel(name) {
  const normalizedName = normalizeChannelName(name);
  if (!normalizedName) return null;

  if (!channels.has(normalizedName)) {
    channels.set(normalizedName, {
      name: normalizedName,
      messages: [],
      members: new Set(),
    });
  }

  return channels.get(normalizedName);
}

function getChannelsPayload() {
  return [...channels.values()]
    .map((channel) => ({
      name: channel.name,
      membersCount: channel.members.size,
      messagesCount: channel.messages.length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function emitChannelsUpdated() {
  io.emit("channels-updated", getChannelsPayload());
}

function getMembersForChannel(channel) {
  return [...channel.members]
    .map((socketId) => usersBySocketId.get(socketId))
    .filter(Boolean)
    .map((user) => ({
      username: user.username,
      avatarUrl: user.avatarUrl || DEFAULT_AVATAR_URL,
    }))
    .sort((a, b) => a.username.localeCompare(b.username));
}

function emitMembersUpdated(channelName) {
  const channel = channels.get(channelName);
  if (!channel) return;
  io.to(channelName).emit("members-updated", {
    channelName,
    members: getMembersForChannel(channel),
  });
}

function getNormalizedMessages(channel) {
  return channel.messages.map((message) => ({
    ...message,
    avatarUrl: message.avatarUrl || DEFAULT_AVATAR_URL,
  }));
}

function clearAllMessages() {
  for (const channel of channels.values()) {
    channel.messages = [];
  }
}

function storeAndBroadcastMessage(channel, message) {
  channel.messages.push(message);
  if (channel.messages.length > MAX_MESSAGES_PER_CHANNEL) {
    channel.messages.shift();
  }
  io.to(channel.name).emit("new-message", message);
}

ensureChannel(DEFAULT_CHANNEL);

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/chat", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "chat.html"));
});

io.on("connection", (socket) => {
  socket.emit("channels-updated", getChannelsPayload());

  socket.on("set-username", (rawUsername, callback) => {
    const username = String(rawUsername || "").trim().slice(0, 24);
    if (!username) {
      callback?.({ ok: false, message: "Poné un nombre de usuario válido." });
      return;
    }

    usersBySocketId.set(socket.id, {
      username,
      avatarUrl: DEFAULT_AVATAR_URL,
      channelName: null,
    });
    callback?.({ ok: true, username, avatarUrl: DEFAULT_AVATAR_URL });
  });

  socket.on("create-channel", (rawChannelName, callback) => {
    const channel = ensureChannel(rawChannelName);
    if (!channel) {
      callback?.({
        ok: false,
        message: "El nombre del canal no es válido.",
      });
      return;
    }

    emitChannelsUpdated();
    callback?.({ ok: true, channelName: channel.name });
  });

  socket.on("join-channel", (rawChannelName, callback) => {
    const user = usersBySocketId.get(socket.id);
    if (!user) {
      callback?.({
        ok: false,
        message: "Primero configurá tu usuario para entrar a un canal.",
      });
      return;
    }

    const nextChannel = ensureChannel(rawChannelName);
    if (!nextChannel) {
      callback?.({ ok: false, message: "Canal inválido." });
      return;
    }

    const previousChannelName = user.channelName;
    if (previousChannelName && channels.has(previousChannelName)) {
      const previousChannel = channels.get(previousChannelName);
      previousChannel.members.delete(socket.id);
      socket.leave(previousChannelName);
      emitMembersUpdated(previousChannelName);
    }

    nextChannel.members.add(socket.id);
    user.channelName = nextChannel.name;
    socket.join(nextChannel.name);

    emitChannelsUpdated();
    emitMembersUpdated(nextChannel.name);

    callback?.({
      ok: true,
      channelName: nextChannel.name,
      messages: getNormalizedMessages(nextChannel),
      members: getMembersForChannel(nextChannel),
    });
  });

  socket.on("chat-message", (rawText, callback) => {
    const user = usersBySocketId.get(socket.id);
    if (!user || !user.channelName) {
      callback?.({ ok: false, message: "No estás dentro de un canal." });
      return;
    }

    const text = String(rawText || "").trim();
    if (!text) {
      callback?.({ ok: false, message: "El mensaje está vacío." });
      return;
    }

    const channel = channels.get(user.channelName);
    if (!channel) {
      callback?.({ ok: false, message: "Canal no encontrado." });
      return;
    }

    const message = {
      id: randomUUID(),
      channelName: channel.name,
      username: user.username,
      avatarUrl: user.avatarUrl || DEFAULT_AVATAR_URL,
      text: text.slice(0, 500),
      createdAt: new Date().toISOString(),
    };
    storeAndBroadcastMessage(channel, message);
    callback?.({ ok: true });
  });

  socket.on("clear-all-messages", (callback) => {
    clearAllMessages();
    emitChannelsUpdated();
    io.emit("messages-cleared");
    callback?.({ ok: true });
  });

  socket.on("disconnect", () => {
    const user = usersBySocketId.get(socket.id);
    usersBySocketId.delete(socket.id);
    if (!user || !user.channelName) return;

    const channel = channels.get(user.channelName);
    if (!channel) return;

    channel.members.delete(socket.id);
    emitChannelsUpdated();
    emitMembersUpdated(channel.name);
  });
});

httpServer.listen(PORT, () => {
  console.log(`ZennedarChat running on http://localhost:${PORT}`);
});
