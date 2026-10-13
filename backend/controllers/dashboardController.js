import Board from "../models/Board.js";
import Task from "../models/Task.js";
import Activity from "../models/Activity.js";

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

    const [
      boards,
      statusAgg,
      priorityAgg,
      overdueCount,
      boardTaskAgg,
      recentActivity,
      assignedTasks,
      assignedOpenTasks,
    ] = await Promise.all([
      Board.find().sort({ updatedAt: -1 }).lean(),
      Task.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Task.aggregate([{ $group: { _id: "$priority", count: { $sum: 1 } } }]),
      Task.countDocuments({
        status: { $ne: "Done" },
        dueDate: { $ne: null, $lt: now },
      }),
      Task.aggregate([
        {
          $group: {
            _id: { board: "$board", status: "$status" },
            count: { $sum: 1 },
          },
        },
      ]),
      Activity.find()
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("board", "title")
        .lean(),
      member ? Task.countDocuments({ assignedTo: member }) : 0,
      member
        ? Task.countDocuments({ assignedTo: member, status: { $ne: "Done" } })
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
      (sum, value) => sum + value,
      0
    );

    const boardStats = new Map();
    for (const row of boardTaskAgg) {
      const boardId = String(row._id.board);
      if (!boardStats.has(boardId)) {
        boardStats.set(boardId, { total: 0, byStatus: emptyCounts(STATUSES) });
      }
      const entry = boardStats.get(boardId);
      entry.total += row.count;
      if (row._id.status in entry.byStatus) {
        entry.byStatus[row._id.status] = row.count;
      }
    }

    const boardSummaries = boards.map((board) => {
      const stats = boardStats.get(String(board._id)) || {
        total: 0,
        byStatus: emptyCounts(STATUSES),
      };
      const done = stats.byStatus.Done || 0;
      const progress = stats.total ? Math.round((done / stats.total) * 100) : 0;

      return {
        _id: board._id,
        title: board.title,
        createdBy: board.createdBy,
        memberCount: Array.isArray(board.members) ? board.members.length : 0,
        members: board.members || [],
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
        taskCount: stats.total,
        doneCount: done,
        byStatus: stats.byStatus,
        progress,
      };
    });

    res.json({
      totals: {
        boards: boards.length,
        tasks: totalTasks,
        completed: statusCounts.Done,
        pending: totalTasks - statusCounts.Done,
        overdue: overdueCount,
      },
      statusCounts,
      priorityCounts,
      assigned: {
        member,
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
