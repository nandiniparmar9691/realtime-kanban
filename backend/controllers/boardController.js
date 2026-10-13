import mongoose from "mongoose";
import Board from "../models/Board.js";
import Task from "../models/Task.js";
import { emitBoardChanged } from "../utils/boardEvents.js";
import { logActivity } from "../utils/activity.js";

export const createBoard = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ message: "Invalid request body" });
    }

    const { title, createdBy } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof createdBy !== "string" ||
      !createdBy.trim()
    ) {
      return res.status(400).json({
        message: "Board title and creator name are required",
      });
    }
    if (title.trim().length > 100 || createdBy.trim().length > 50) {
      return res.status(400).json({ message: "Board details are too long" });
    }

    const board = await Board.create({
      title: title.trim(),
      createdBy: createdBy.trim(),
      members: [createdBy.trim()],
    });

    await logActivity({
      board: board._id,
      type: "board_created",
      actor: createdBy.trim(),
      message: `created board "${board.title}"`,
    });

    res.status(201).json(board);
  } catch (error) {
    next(error);
  }
};

export const getBoards = async (req, res, next) => {
  try {
    const boards = await Board.find().sort({ updatedAt: -1 });
    res.json(boards);
  } catch (error) {
    next(error);
  }
};

export const getBoard = async (req, res, next) => {
  try {
    const { boardId } = req.params;

    if (!mongoose.isObjectIdOrHexString(boardId)) {
      return res.status(400).json({ message: "Invalid board ID" });
    }

    const board = await Board.findById(boardId);

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    const tasks = await Task.find({ board: boardId }).sort({
      status: 1,
      position: 1,
      createdAt: 1,
    });

    res.json({ board, tasks });
  } catch (error) {
    next(error);
  }
};

export const inviteMember = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ message: "Invalid request body" });
    }

    const { boardId } = req.params;
    const { memberName } = req.body;

    if (!mongoose.isObjectIdOrHexString(boardId)) {
      return res.status(400).json({ message: "Invalid board ID" });
    }

    if (typeof memberName !== "string" || !memberName.trim()) {
      return res.status(400).json({
        message: "Member name is required",
      });
    }

    if (memberName.trim().length > 50) {
      return res.status(400).json({
        message: "Member name is too long",
      });
    }

    const board = await Board.findById(boardId);

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    const name = memberName.trim();

    if (!board.members.includes(name)) {
      board.members.push(name);
      await board.save();
      await logActivity({
        board: board._id,
        type: "member_added",
        actor: name,
        message: `joined board "${board.title}"`,
      });
    }

    emitBoardChanged(req, boardId);
    res.json(board);
  } catch (error) {
    next(error);
  }
};