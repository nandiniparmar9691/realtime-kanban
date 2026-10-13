import Activity from "../models/Activity.js";

export async function logActivity({
  board,
  task = null,
  type,
  actor = "Guest",
  message,
  meta = {},
}) {
  if (!board || !type || !message) return null;

  try {
    return await Activity.create({
      board,
      task,
      type,
      actor: typeof actor === "string" && actor.trim() ? actor.trim().slice(0, 50) : "Guest",
      message: String(message).slice(0, 300),
      meta,
    });
  } catch (error) {
    console.error("Failed to record activity:", error.message);
    return null;
  }
}
