import mongoose from "mongoose";
import Board from "../models/Board.js";
import Activity from "../models/Activity.js";

export const getBoardActivity = async (req, res, next) => {
  try {
    const { boardId } = req.params;

    if (!mongoose.isObjectIdOrHexString(boardId)) {
      return res.status(400).json({ message: "Invalid board ID" });
    }

    const boardExists = await Board.exists({ _id: boardId });

    if (!boardExists) {
      return res.status(404).json({ message: "Board not found" });
    }

    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 30, 1),
      100
    );

    const activities = await Activity.find({ board: boardId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("board", "title")
      .lean();

    res.json(activities);
  } catch (error) {
    next(error);
  }
};

export const getRecentActivity = async (req, res, next) => {
  try {
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
      100
    );

    const activities = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("board", "title")
      .lean();

    res.json(activities);
  } catch (error) {
    next(error);
  }
};
