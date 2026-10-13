import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import Task from "../models/Task.js";
import { logActivity } from "../utils/activity.js";
import { emitBoardChanged } from "../utils/boardEvents.js";
import { UPLOAD_DIR } from "../middleware/upload.js";

const validId = (id) =>
  typeof id === "string" && mongoose.isObjectIdOrHexString(id);

export const addAttachment = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    if (!validId(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ message: "Task not found" });
    }

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    const uploadedBy =
      typeof req.body?.uploadedBy === "string" && req.body.uploadedBy.trim()
        ? req.body.uploadedBy.trim().slice(0, 50)
        : "Guest";

    task.attachments.push({
      name: req.file.originalname.slice(0, 255),
      url: fileUrl,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedBy,
      uploadedAt: new Date(),
    });

    await task.save();

    await logActivity({
      board: task.board,
      task: task._id,
      type: "attachment_added",
      actor: uploadedBy,
      message: `attached "${req.file.originalname}" to "${task.title}"`,
      meta: { filename: req.file.filename },
    });

    emitBoardChanged(req, task.board);
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
};

export const deleteAttachment = async (req, res, next) => {
  try {
    const { taskId, attachmentId } = req.params;

    if (!validId(taskId) || !validId(attachmentId)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const attachment = task.attachments.id(attachmentId);

    if (!attachment) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    const filename = path.basename(new URL(attachment.url).pathname);
    attachment.deleteOne();
    await task.save();

    if (filename && filename !== "." && filename !== "/") {
      fs.unlink(path.join(UPLOAD_DIR, filename), () => {});
    }

    emitBoardChanged(req, task.board);
    res.json(task);
  } catch (error) {
    next(error);
  }
};
