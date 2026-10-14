import mongoose from "mongoose";
import Task from "../models/Task.js";
import { emitBoardChanged } from "../utils/boardEvents.js";
import { withBoardMutationLock } from "../utils/boardMutationQueue.js";
import { logActivity } from "../utils/activity.js";
import { loadBoardForUser } from "../utils/boardAccess.js";

const STATUSES = ["Todo", "In Progress", "Review", "Done"];
const PRIORITIES = ["Low", "Medium", "High"];

const validId = (id) =>
  typeof id === "string" && mongoose.isObjectIdOrHexString(id);

async function normalizePositions(boardId) {
  for (const status of STATUSES) {
    const tasks = await Task.find({ board: boardId, status })
      .sort({ position: 1, updatedAt: 1, _id: 1 })
      .select("_id");

    await Promise.all(
      tasks.map((task, index) =>
        Task.updateOne(
          { _id: task._id },
          { $set: { position: index } }
        )
      )
    );
  }
}

export const createTask = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ message: "Invalid request body" });
    }

    const { boardId } = req.params;
    const {
      title,
      description,
      priority,
      dueDate,
      assignedTo,
      status,
      createdBy,
    } = req.body;

    if (!validId(boardId)) {
      return res.status(400).json({ message: "Invalid board ID" });
    }

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "Task title is required" });
    }

    if (status !== undefined && !STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid task status" });
    }

    if (priority !== undefined && !PRIORITIES.includes(priority)) {
      return res.status(400).json({ message: "Invalid priority" });
    }

    if (title.trim().length > 200) {
      return res.status(400).json({ message: "Task title is too long" });
    }

    if (description !== undefined && typeof description !== "string") {
      return res.status(400).json({ message: "Invalid task description" });
    }
    if (description?.length > 5000) {
      return res.status(400).json({ message: "Task description is too long" });
    }

    if (assignedTo !== undefined && typeof assignedTo !== "string") {
      return res.status(400).json({ message: "Invalid assigned member" });
    }
    if (assignedTo?.trim().length > 50) {
      return res.status(400).json({ message: "Assigned member name is too long" });
    }
    if (
      dueDate !== undefined &&
      dueDate !== null &&
      (typeof dueDate !== "string" || !Number.isFinite(Date.parse(dueDate)))
    ) {
      return res.status(400).json({ message: "Invalid due date" });
    }
    if (
      createdBy !== undefined &&
      (typeof createdBy !== "string" || createdBy.trim().length > 50)
    ) {
      return res.status(400).json({ message: "Invalid creator name" });
    }

    await withBoardMutationLock(boardId, async () => {
      const board = await loadBoardForUser(boardId, req.user);

      if (!board) {
        res.status(404).json({ message: "Board not found" });
        return;
      }

      const taskStatus = status || "Todo";
      const position = await Task.countDocuments({
        board: boardId,
        status: taskStatus,
      });

      const task = await Task.create({
        board: boardId,
        title: title.trim(),
        description,
        priority,
        dueDate: dueDate || null,
        assignedTo: assignedTo?.trim(),
        status: taskStatus,
        position,
        createdBy: createdBy?.trim() || "Guest",
      });

      await logActivity({
        board: boardId,
        task: task._id,
        type: "task_created",
        actor: createdBy?.trim() || "Guest",
        message: `created task "${task.title}"`,
        meta: { status: task.status, priority: task.priority },
      });

      emitBoardChanged(req, boardId);
      res.status(201).json(task);
    });
  } catch (error) {
    next(error);
  }
};

export const updateTask = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ message: "Invalid request body" });
    }

    const { taskId } = req.params;

    if (!validId(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const allowed = [
      "title",
      "description",
      "priority",
      "dueDate",
      "assignedTo",
      "status",
    ];

    const updates = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (updates.title !== undefined) {
      if (typeof updates.title !== "string" || !updates.title.trim()) {
        return res.status(400).json({ message: "Task title is required" });
      }
      updates.title = updates.title.trim();
    }

    if (updates.status !== undefined && !STATUSES.includes(updates.status)) {
      return res.status(400).json({ message: "Invalid task status" });
    }

    if (updates.priority !== undefined && !PRIORITIES.includes(updates.priority)) {
      return res.status(400).json({ message: "Invalid priority" });
    }

    if (
      updates.description !== undefined &&
      typeof updates.description !== "string"
    ) {
      return res.status(400).json({ message: "Invalid task description" });
    }
    if (updates.description?.length > 5000) {
      return res.status(400).json({ message: "Task description is too long" });
    }

    if (
      updates.assignedTo !== undefined &&
      typeof updates.assignedTo !== "string"
    ) {
      return res.status(400).json({ message: "Invalid assigned member" });
    }
    if (updates.assignedTo !== undefined) {
      updates.assignedTo = updates.assignedTo.trim();
      if (updates.assignedTo.length > 50) {
        return res.status(400).json({ message: "Assigned member name is too long" });
      }
    }

    if (
      updates.dueDate !== undefined &&
      updates.dueDate !== null &&
      (typeof updates.dueDate !== "string" ||
        Number.isNaN(Date.parse(updates.dueDate)) ||
        !Number.isFinite(Date.parse(updates.dueDate)))
    ) {
      return res.status(400).json({ message: "Invalid due date" });
    }

    const existingTask = await Task.findById(taskId);

    if (!existingTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    await loadBoardForUser(existingTask.board, req.user);

    const actor =
      typeof req.body.actor === "string" && req.body.actor.trim()
        ? req.body.actor.trim().slice(0, 50)
        : "Guest";

    await withBoardMutationLock(existingTask.board, async () => {
      const oldTask = await Task.findById(taskId);

      if (!oldTask) {
        res.status(404).json({ message: "Task not found" });
        return;
      }

      const oldStatus = oldTask.status;
      const oldAssignee = oldTask.assignedTo;
      Object.assign(oldTask, updates);

      if (updates.status && updates.status !== oldStatus) {
        oldTask.position = await Task.countDocuments({
          board: oldTask.board,
          status: updates.status,
        });
      }

      await oldTask.save();

      if (updates.status && updates.status !== oldStatus) {
        await normalizePositions(oldTask.board);
      }

      const statusChanged =
        updates.status !== undefined && updates.status !== oldStatus;
      const assigneeChanged =
        updates.assignedTo !== undefined &&
        updates.assignedTo !== oldAssignee;

      if (statusChanged) {
        await logActivity({
          board: oldTask.board,
          task: oldTask._id,
          type: "task_moved",
          actor,
          message: `moved "${oldTask.title}" from ${oldStatus} to ${updates.status}`,
          meta: { from: oldStatus, to: updates.status },
        });
      } else if (assigneeChanged) {
        await logActivity({
          board: oldTask.board,
          task: oldTask._id,
          type: "task_assigned",
          actor,
          message: oldTask.assignedTo
            ? `assigned "${oldTask.title}" to ${oldTask.assignedTo}`
            : `unassigned "${oldTask.title}"`,
          meta: { to: oldTask.assignedTo || null },
        });
      } else {
        await logActivity({
          board: oldTask.board,
          task: oldTask._id,
          type: "task_updated",
          actor,
          message: `updated task "${oldTask.title}"`,
        });
      }

      emitBoardChanged(req, oldTask.board);
      res.json(oldTask);
    });
  } catch (error) {
    next(error);
  }
};

export const moveTask = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ message: "Invalid request body" });
    }

    const { taskId } = req.params;
    const { status, position } = req.body;

    if (!validId(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid task status" });
    }

    if (
      !Number.isInteger(position) ||
      position < 0
    ) {
      return res.status(400).json({ message: "Invalid position" });
    }

    const existingTask = await Task.findById(taskId);

    if (!existingTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    await loadBoardForUser(existingTask.board, req.user);

    const actor =
      typeof req.body.actor === "string" && req.body.actor.trim()
        ? req.body.actor.trim().slice(0, 50)
        : "Guest";

    await withBoardMutationLock(existingTask.board, async () => {
      const task = await Task.findById(taskId);

      if (!task) {
        res.status(404).json({ message: "Task not found" });
        return;
      }

      const fromStatus = task.status;
      const fromPosition = task.position;

      const boardTasks = await Task.find({ board: task.board }).sort({
        position: 1,
        updatedAt: 1,
        _id: 1,
      });
      const source = boardTasks.filter((item) => item.status === task.status);
      const target =
        status === task.status
          ? source
          : boardTasks.filter((item) => item.status === status);
      const sourceIndex = source.findIndex(
        (item) => String(item._id) === String(task._id)
      );

      if (sourceIndex !== -1) source.splice(sourceIndex, 1);
      target.splice(Math.min(position, target.length), 0, task);

      if (status === task.status) {
        await persistColumnOrder(status, target);
      } else {
        await Promise.all([
          persistColumnOrder(task.status, source),
          persistColumnOrder(status, target),
        ]);
      }

      const updatedTask = await Task.findById(taskId);

      if (fromStatus !== status || fromPosition !== position) {
        await logActivity({
          board: task.board,
          task: task._id,
          type: "task_moved",
          actor,
          message:
            fromStatus === status
              ? `reordered task "${task.title}"`
              : `moved "${task.title}" from ${fromStatus} to ${status}`,
          meta: { from: fromStatus, to: status, position },
        });
      }

      emitBoardChanged(req, task.board);
      res.json(updatedTask);
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    if (!validId(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const existingTask = await Task.findById(taskId);

    if (!existingTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    await loadBoardForUser(existingTask.board, req.user);

    await withBoardMutationLock(existingTask.board, async () => {
      const task = await Task.findByIdAndDelete(taskId);

      if (!task) {
        res.status(404).json({ message: "Task not found" });
        return;
      }

      await normalizePositions(task.board);

      await logActivity({
        board: task.board,
        type: "task_deleted",
        actor:
          typeof req.body?.actor === "string" && req.body.actor.trim()
            ? req.body.actor.trim().slice(0, 50)
            : "Guest",
        message: `deleted task "${task.title}"`,
        meta: { status: task.status },
      });

      emitBoardChanged(req, task.board);
      res.json({ message: "Task deleted successfully" });
    });
  } catch (error) {
    next(error);
  }
};

async function persistColumnOrder(status, tasks) {
  if (!tasks.length) return;

  await Task.bulkWrite(
    tasks.map((task, position) => ({
      updateOne: {
        filter: { _id: task._id },
        update: { $set: { status, position } },
      },
    }))
  );
}