import express from "express";
import {
  updateTask,
  moveTask,
  deleteTask,
} from "../controllers/taskController.js";
import {
  getComments,
  addComment,
  deleteComment,
} from "../controllers/commentController.js";
import {
  addAttachment,
  deleteAttachment,
} from "../controllers/attachmentController.js";
import { uploadSingle } from "../middleware/upload.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(requireAuth);

router.patch("/:taskId", updateTask);
router.patch("/:taskId/move", moveTask);
router.delete("/:taskId", deleteTask);

router.get("/:taskId/comments", getComments);
router.post("/:taskId/comments", addComment);
router.delete("/comments/:commentId", deleteComment);

router.post("/:taskId/attachments", uploadSingle, addAttachment);
router.delete("/:taskId/attachments/:attachmentId", deleteAttachment);

export default router;
