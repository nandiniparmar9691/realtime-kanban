import express from "express";
import {
  createBoard,
  getBoards,
  getBoard,
  inviteMember,
} from "../controllers/boardController.js";
import { createTask } from "../controllers/taskController.js";
import { getBoardActivity } from "../controllers/activityController.js";

const router = express.Router();

router.post("/", createBoard);
router.get("/", getBoards);
router.get("/:boardId", getBoard);
router.get("/:boardId/activity", getBoardActivity);
router.post("/:boardId/members", inviteMember);
router.post("/:boardId/tasks", createTask);

export default router;
