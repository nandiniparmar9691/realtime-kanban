import mongoose from "mongoose";
import Board from "../models/Board.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import { emitBoardChanged } from "../utils/boardEvents.js";
import { logActivity } from "../utils/activity.js";
import {
  loadBoardForUser,
  accessibleBoardFilter,
} from "../utils/boardAccess.js";

export const createBoard = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ message: "Invalid request body" });
    }

    const { title } = req.body;

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "Board title is required" });
    }
    if (title.trim().length > 100) {
      return res.status(400).json({ message: "Board title is too long" });
    }

    // The creator is taken from the authenticated session, never the client body.
    const creatorName = req.user.name;

    const board = await Board.create({
      title: title.trim(),
      createdBy: creatorName,
      members: [creatorName],
      owner: req.user._id,
      memberIds: [req.user._id],
    });

    await logActivity({
      board: board._id,
      type: "board_created",
      actor: creatorName,
      message: `created board "${board.title}"`,
    });

    res.status(201).json(board);
  } catch (error) {
    next(error);
  }
};

export const getBoards = async (req, res, next) => {
  try {
    const boards = await Board.find(accessibleBoardFilter(req.user)).sort({
      updatedAt: -1,
    });
    res.json(boards);
  } catch (error) {
    next(error);
  }
};

export const getBoard = async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const board = await loadBoardForUser(boardId, req.user);

    const tasks = await Task.find({ board: board._id }).sort({
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
    const { memberEmail, memberName } = req.body;

    const board = await loadBoardForUser(boardId, req.user);

    if (
      typeof memberEmail === "string" &&
      memberEmail.trim()
    ) {
      const email = memberEmail.trim().toLowerCase();
      const invitee = await User.findOne({ email });

      if (!invitee) {
        return res.status(404).json({
          message: "No account found with that email address",
        });
      }

      const alreadyMember = (board.memberIds || []).some(
        (id) => String(id) === String(invitee._id)
      );

      if (!alreadyMember) {
        board.memberIds.push(invitee._id);
        if (!board.members.includes(invitee.name)) {
          board.members.push(invitee.name);
        }
        await board.save();
        await logActivity({
          board: board._id,
          type: "member_added",
          actor: req.user.name,
          message: `added ${invitee.name} to board "${board.title}"`,
        });
      }

      emitBoardChanged(req, board._id);
      return res.json(board);
    }

    if (typeof memberName !== "string" || !memberName.trim()) {
      return res.status(400).json({ message: "Member email is required" });
    }

    if (memberName.trim().length > 50) {
      return res.status(400).json({ message: "Member name is too long" });
    }

    const name = memberName.trim();

    if (!board.members.includes(name)) {
      board.members.push(name);
      await board.save();
      await logActivity({
        board: board._id,
        type: "member_added",
        actor: req.user.name,
        message: `added ${name} to board "${board.title}"`,
      });
    }

    emitBoardChanged(req, board._id);
    return res.json(board);
  } catch (error) {
    return next(error);
  }
};
