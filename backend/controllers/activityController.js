import Board from "../models/Board.js";
import Activity from "../models/Activity.js";
import {
  loadBoardForUser,
  accessibleBoardFilter,
} from "../utils/boardAccess.js";

export const getBoardActivity = async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const board = await loadBoardForUser(boardId, req.user);

    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 30, 1),
      100
    );

    const activities = await Activity.find({ board: board._id })
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

    const boards = await Board.find(accessibleBoardFilter(req.user))
      .select("_id")
      .lean();
    const boardIds = boards.map((board) => board._id);

    const activities = await Activity.find({ board: { $in: boardIds } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("board", "title")
      .lean();

    res.json(activities);
  } catch (error) {
    next(error);
  }
};
