import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import boardRoutes from "./routes/boardRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import { errorMiddleware } from "./middleware/errorMiddleware.js";
import { UPLOAD_DIR } from "./middleware/upload.js";
import { TOKEN_COOKIE } from "./middleware/authMiddleware.js";

// Fail loudly in the logs (never printing values) when required config is
// missing, so misconfiguration surfaces immediately instead of as a 500.
const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET"];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(
    `[startup] Missing required environment variables: ${missingEnv.join(
      ", "
    )}. Login/registration will fail until they are configured.`
  );
}

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",") : []),
  "http://localhost:5173",
]
  .map((origin) => (typeof origin === "string" ? origin.trim() : ""))
  .filter(Boolean);

const isDevelopment = process.env.NODE_ENV !== "production";
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function isAllowedOrigin(origin) {
  // Allow same-origin / server-to-server requests that send no Origin header.
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // In development, accept any localhost/127.0.0.1 port (vite may pick 5174+).
  if (isDevelopment && LOCAL_ORIGIN.test(origin)) return true;
  return false;
}

const corsOptions = {
  origin(origin, callback) {
    // Deny by omitting CORS headers instead of throwing, so a blocked
    // origin returns a normal response rather than an HTTP 500.
    return callback(null, isAllowedOrigin(origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      return callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
});

// Only authenticated users may open a Socket.IO connection.
io.use((socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers?.cookie || "";
    const token = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${TOKEN_COOKIE}=`))
      ?.slice(TOKEN_COOKIE.length + 1);

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const payload = jwt.verify(decodeURIComponent(token), process.env.JWT_SECRET);
    socket.data.userId = payload.sub;
    return next();
  } catch {
    return next(new Error("Authentication required"));
  }
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

    socket.data.boardId = boardId;
    socket.data.memberName =
      typeof memberName === "string" && memberName.trim()
        ? memberName.trim().slice(0, 50)
        : "Teammate";

    socket.join(`board:${boardId}`);
    broadcastMembers(boardId);
    socket.emit("board:joined", { boardId });
  });

  socket.on("board:leave", (data = {}) => {
    const boardId = data.boardId || socket.data.boardId;
    if (typeof boardId !== "string") return;

    socket.leave(`board:${boardId}`);
    if (socket.data.boardId === boardId) {
      delete socket.data.boardId;
      delete socket.data.memberName;
    }
    broadcastMembers(boardId);
  });

  socket.on("typing:start", (data = {}) => {
    const { boardId } = data;
    if (typeof boardId !== "string" || boardId !== socket.data.boardId) return;

    socket.to(`board:${boardId}`).emit("typing:update", {
      boardId,
      memberName: socket.data.memberName,
      typing: true,
    });
  });

  socket.on("typing:stop", (data = {}) => {
    const { boardId } = data;
    if (typeof boardId !== "string" || boardId !== socket.data.boardId) return;

    socket.to(`board:${boardId}`).emit("typing:update", {
      boardId,
      memberName: socket.data.memberName,
      typing: false,
    });
  });

  socket.on("disconnect", () => {
    if (socket.data.boardId) {
      broadcastMembers(socket.data.boardId);
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

app.use("/api/auth", authRoutes);
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
