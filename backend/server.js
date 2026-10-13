import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import boardRoutes from "./routes/boardRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import { errorMiddleware } from "./middleware/errorMiddleware.js";
import { UPLOAD_DIR } from "./middleware/upload.js";

const app = express();
const server = http.createServer(app);

const CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
});

app.set("io", io);

function broadcastMembers(boardId) {
  const room = `board:${boardId}`;
  const socketIds = io.sockets.adapter.rooms.get(room) || new Set();

  const onlineMembers = [...socketIds]
    .map((id) => io.sockets.sockets.get(id)?.data.memberName)
    .filter(Boolean);

  io.to(room).emit("members:changed", {
    boardId: String(boardId),
    onlineMembers: [...new Set(onlineMembers)],
  });
}

io.on("connection", (socket) => {
  socket.on("board:join", (data = {}) => {
    const { boardId, memberName } = data;

    if (typeof boardId !== "string" || !/^[a-f\d]{24}$/i.test(boardId)) return;

    // Leave the previous board room, if any.
    if (socket.data.boardId) {
      const previousBoardId = socket.data.boardId;
      socket.to(`board:${previousBoardId}`).emit("typing:update", {
        boardId: previousBoardId,
        memberName: socket.data.memberName,
        typing: false,
      });
      socket.leave(`board:${previousBoardId}`);
      broadcastMembers(previousBoardId);
    }

    socket.join(`board:${boardId}`);
    socket.data.boardId = String(boardId);
    socket.data.memberName =
      typeof memberName === "string" && memberName.trim()
        ? memberName.trim().slice(0, 50)
        : "Guest";

    broadcastMembers(boardId);
    socket.emit("board:joined", { boardId: String(boardId) });
  });

  socket.on("board:leave", (data = {}) => {
    const boardId = socket.data.boardId;

    if (!boardId || (data.boardId && String(data.boardId) !== boardId)) return;

    socket.to(`board:${boardId}`).emit("typing:update", {
      boardId,
      memberName: socket.data.memberName,
      typing: false,
    });
    socket.leave(`board:${boardId}`);
    delete socket.data.boardId;
    delete socket.data.memberName;
    broadcastMembers(boardId);
  });

  socket.on("typing:start", (data = {}) => {
    const { boardId } = data;

    if (
      !boardId ||
      String(boardId) !== socket.data.boardId
    ) {
      return;
    }

    socket.to(`board:${boardId}`).emit("typing:update", {
      boardId: String(boardId),
      memberName: socket.data.memberName,
      typing: true,
    });
  });

  socket.on("typing:stop", (data = {}) => {
    const { boardId } = data;

    if (
      !boardId ||
      String(boardId) !== socket.data.boardId
    ) {
      return;
    }

    socket.to(`board:${boardId}`).emit("typing:update", {
      boardId: String(boardId),
      memberName: socket.data.memberName,
      typing: false,
    });
  });

  socket.on("disconnect", () => {
    if (socket.data.boardId) {
      const boardId = socket.data.boardId;

      socket.to(`board:${boardId}`).emit("typing:update", {
        boardId: String(boardId),
        memberName: socket.data.memberName,
        typing: false,
      });

      broadcastMembers(boardId);
    }
  });
});

app.get("/", (req, res) => {
  res.json({ message: "Kanban API is running" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/uploads", express.static(UPLOAD_DIR));

app.use("/api/boards", boardRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/activity", activityRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "API route not found" });
});

app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

await connectDB();

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});