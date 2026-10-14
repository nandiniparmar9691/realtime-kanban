import Board from "../models/Board.js";
import Task from "../models/Task.js";
import Activity from "../models/Activity.js";
import { accessibleBoardFilter } from "../utils/boardAccess.js";

const STATUSES = ["Todo", "In Progress", "Review", "Done"];
const PRIORITIES = ["Low", "Medium", "High"];

const emptyCounts = (keys) =>
  keys.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

export const getDashboard = async (req, res, next) => {
  try {
    const member =
      typeof req.query.member === "string" ? req.query.member.trim() : "";
    const now = new Date();

    const boards = await Board.find(accessibleBoardFilter(req.user))
      .sort({ updatedAt: -1 })
      .lean();
    const boardIds = boards.map((board) => board._id);
    const boardScope = { board: { $in: boardIds } };

    const [
      statusAgg,
      priorityAgg,
      overdueCount,
      boardTaskAgg,
      recentActivity,
      assignedTasks,
      assignedOpenTasks,
    ] = await Promise.all([
      Task.aggregate([
        { $match: boardScope },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Task.aggregate([
        { $match: boardScope },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
      Task.countDocuments({
        ...boardScope,
        status: { $ne: "Done" },
        dueDate: { $ne: null, $lt: now },
      }),
      Task.aggregate([
        { $match: boardScope },
        {
          $group: {
            _id: { board: "$board", status: "$status" },
            count: { $sum: 1 },
          },
        },
      ]),
      Activity.find(boardScope)
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("board", "title")
        .lean(),
      member ? Task.countDocuments({ ...boardScope, assignedTo: member }) : 0,
      member
        ? Task.countDocuments({
            ...boardScope,
            assignedTo: member,
            status: { $ne: "Done" },
          })
        : 0,
    ]);

    const statusCounts = emptyCounts(STATUSES);
    for (const row of statusAgg) {
      if (row._id in statusCounts) statusCounts[row._id] = row.count;
    }

    const priorityCounts = emptyCounts(PRIORITIES);
    for (const row of priorityAgg) {
      if (row._id in priorityCounts) priorityCounts[row._id] = row.count;
    }

    const totalTasks = Object.values(statusCounts).reduce(
      (sum, count) => sum + count,
      0
    );

    const boardTaskAggMap = new Map();
    for (const row of boardTaskAgg) {
      const boardId = String(row._id.board);
      if (!boardTaskAggMap.has(boardId)) {
        boardTaskAggMap.set(boardId, emptyCounts(["total", ...STATUSES]));
      }
      const counts = boardTaskAggMap.get(boardId);
      counts.total += row.count;
      if (row._id.status in counts) counts[row._id.status] += row.count;
    }

    boards.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    const boardSummaries = boards.map((board) => {
      const counts =
        boardTaskAggMap.get(String(board._id)) || emptyCounts(["total", ...STATUSES]);
      const total = counts.total;
      const done = counts.Done;
      const progress = total ? Math.round((done / total) * 100) : 0;

      return {
        _id: board._id,
        title: board.title,
        createdBy: board.createdBy,
        memberCount: (board.members || []).length,
        taskCount: total,
        progress,
        statusCounts: STATUSES.reduce((acc, status) => {
          acc[status] = counts[status];
          return acc;
        }, {}),
      };
    });

    // Keep the original dashboard response shape for the existing UI.
    const completed = statusCounts.Done;
    const pending = totalTasks - completed;

    res.json({
      totals: {
        boards: boards.length,
        tasks: totalTasks,
        completed,
        pending,
        overdue: overdueCount,
      },
      statusCounts,
      priorityCounts,
      assigned: {
        member: member || null,
        total: assignedTasks,
        open: assignedOpenTasks,
      },
      boards: boardSummaries,
      recentActivity,
    });
  } catch (error) {
    next(error);
  }
};
