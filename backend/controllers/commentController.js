import mongoose from "mongoose";
import Comment from "../models/Comment.js";
import Task from "../models/Task.js";
import { logActivity } from "../utils/activity.js";
import { emitBoardChanged } from "../utils/boardEvents.js";

const validId = (id) =>
  typeof id === "string" && mongoose.isObjectIdOrHexString(id);

export const getComments = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    if (!validId(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const taskExists = await Task.exists({ _id: taskId });

    if (!taskExists) {
      return res.status(404).json({ message: "Task not found" });
    }

    const comments = await Comment.find({ task: taskId })
      .sort({ createdAt: 1 })
      .lean();

    res.json(comments);
  } catch (error) {
    next(error);
  }
};

export const addComment = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ message: "Invalid request body" });
    }

    const { taskId } = req.params;
    const { author, text } = req.body;

    if (!validId(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    if (text.trim().length > 1000) {
      return res.status(400).json({ message: "Comment is too long" });
    }

    if (author !== undefined && typeof author !== "string") {
      return res.status(400).json({ message: "Invalid comment author" });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const comment = await Comment.create({
      task: task._id,
      board: task.board,
      author: author?.trim() || "Guest",
      text: text.trim(),
    });

    await logActivity({
      board: task.board,
      task: task._id,
      type: "comment_added",
      actor: author?.trim() || "Guest",
      message: `commented on "${task.title}"`,
      meta: { commentId: String(comment._id) },
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`board:${task.board}`).emit("comment:new", {
        boardId: String(task.board),
        taskId: String(task._id),
        comment: comment.toObject(),
      });
    }

    emitBoardChanged(req, task.board);
    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;

    if (!validId(commentId)) {
      return res.status(400).json({ message: "Invalid comment ID" });
    }

    const comment = await Comment.findByIdAndDelete(commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    emitBoardChanged(req, comment.board);
    res.json({ message: "Comment deleted successfully" });
  } catch (error) {
    next(error);
  }
};
