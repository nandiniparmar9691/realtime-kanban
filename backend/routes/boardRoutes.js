import express from "express";
import {
  createBoard,
  getBoards,
  getBoard,
  inviteMember,
} from "../controllers/boardController.js";
import { createTask } from "../controllers/taskController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(requireAuth);

router.post("/", createBoard);
router.get("/", getBoards);
router.get("/:boardId", getBoard);
router.post("/:boardId/tasks", createTask);
router.post("/:boardId/members", inviteMember);

export default router;
