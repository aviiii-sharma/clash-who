const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const celebrities = require("./topics/celebrities");
const clashRoyale = require("./topics/clashRoyale");
const crTypes = require("./topics/clashRoyaleTypes");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = {};

/* ------------------ HELPERS ------------------ */

function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getCharactersForTopic(topic) {
  if (topic === "celebrities") return celebrities;
  if (topic === "clash-royale") return clashRoyale;
  return [];
}

function classifyClashRoyale(cards) {
  return cards.map((c) => {
    if (crTypes.spells.includes(c.id)) {
      return { ...c, type: "spell" };
    }
    if (crTypes.buildings.includes(c.id)) {
      return { ...c, type: "building" };
    }
    return { ...c, type: "troop" }; // includes EVO troops
  });
}

function pickRandom(arr, n) {
  if (arr.length <= n) return [...arr];
  return [...arr].sort(() => 0.5 - Math.random()).slice(0, n);
}

function generateBalancedPool(allCards, poolSize) {
  const troops = allCards.filter((c) => c.type === "troop");
  const spells = allCards.filter((c) => c.type === "spell");
  const buildings = allCards.filter((c) => c.type === "building");

  const troopCount = Math.floor(poolSize * 0.6);
  const spellCount = Math.floor(poolSize * 0.25);
  const buildingCount = poolSize - troopCount - spellCount;

  return [
    ...pickRandom(troops, troopCount),
    ...pickRandom(spells, spellCount),
    ...pickRandom(buildings, buildingCount),
  ].sort(() => 0.5 - Math.random());
}

/* ------------------ SOCKETS ------------------ */

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // CREATE ROOM
  socket.on("create-room", ({ playerName }) => {
    const roomCode = generateRoomCode();

    rooms[roomCode] = {
      status: "waiting",
      host: socket.id,
      topic: null,
      characters: [],
      settings: {
        poolSize: 32,
      },
      players: {
        p1: { socketId: socket.id, name: playerName, secret: null },
        p2: null,
      },
      currentTurn: null,
      guesses: { p1: false, p2: false },
    };

    socket.join(roomCode);
    socket.emit("room-created", { roomCode });
  });

  // JOIN ROOM
  socket.on("join-room", ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room || room.players.p2) return;

    room.players.p2 = {
      socketId: socket.id,
      name: playerName,
      secret: null,
    };

    room.status = "topic-selection";
    socket.join(roomCode);

    io.to(roomCode).emit("player-joined", {
      status: room.status,
      hostId: room.host,
      players: {
        p1: room.players.p1.name,
        p2: room.players.p2.name,
      },
    });
  });

  // UPDATE SETTINGS
  socket.on("update-settings", ({ roomCode, poolSize }) => {
    const room = rooms[roomCode];
    if (!room || socket.id !== room.host) return;

    room.settings.poolSize = poolSize;

    io.to(roomCode).emit("settings-updated", { poolSize });
  });

  // CHOOSE TOPIC
  socket.on("choose-topic", ({ roomCode, topic }) => {
    const room = rooms[roomCode];
    if (!room || socket.id !== room.host) return;

    room.topic = topic;

    if (topic === "clash-royale") {
      let allCards = classifyClashRoyale(
        getCharactersForTopic(topic)
      );

      room.characters = generateBalancedPool(
        allCards,
        room.settings.poolSize
      );
    } else {
      room.characters = getCharactersForTopic(topic);
    }

    room.status = "selecting";

    io.to(roomCode).emit("topic-chosen", {
      topic,
      characters: room.characters,
      status: room.status,
    });
  });

  // SELECT CHARACTER
  socket.on("select-character", ({ roomCode, characterId }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const player =
      room.players.p1.socketId === socket.id ? "p1" : "p2";

    if (room.players[player].secret) return;

    room.players[player].secret = characterId;

    if (room.players.p1.secret && room.players.p2.secret) {
      room.status = "playing";
      room.currentTurn = "p1";
      room.guesses = { p1: false, p2: false };

      io.to(roomCode).emit("start-game", {
        currentTurn: room.currentTurn,
      });
    }
  });

  // MAKE GUESS
  socket.on("make-guess", ({ roomCode, characterId }) => {
    const room = rooms[roomCode];
    if (!room || room.status !== "playing") return;

    const current = room.currentTurn;
    const opponent = current === "p1" ? "p2" : "p1";

    if (room.players[current].socketId !== socket.id) return;

    room.guesses[current] = true;

    if (room.players[opponent].secret === characterId) {
      io.to(roomCode).emit("game-ended", {
        winner: room.players[current].name,
        reason: "correct",
      });
      resetRoom(roomCode);
      return;
    }

    if (room.guesses[opponent]) {
      io.to(roomCode).emit("game-ended", {
        winner: null,
        reason: "both-wrong",
      });
      resetRoom(roomCode);
      return;
    }

    room.currentTurn = opponent;
    io.to(roomCode).emit("turn-changed", {
      currentTurn: room.currentTurn,
    });
  });

  // END TURN
  socket.on("end-turn", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.status !== "playing") return;

    const current = room.currentTurn;
    if (room.players[current].socketId !== socket.id) return;

    room.currentTurn = current === "p1" ? "p2" : "p1";

    io.to(roomCode).emit("turn-changed", {
      currentTurn: room.currentTurn,
    });
  });
});

/* ------------------ RESET ------------------ */

function resetRoom(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  setTimeout(() => {
    room.status = "topic-selection";
    room.topic = null;
    room.characters = [];
    room.players.p1.secret = null;
    room.players.p2.secret = null;
    room.currentTurn = null;
    room.guesses = { p1: false, p2: false };

    io.to(roomCode).emit("reset-to-topic");
  }, 3000);
}

const PORT = process.env.PORT || 3001;

server.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);

