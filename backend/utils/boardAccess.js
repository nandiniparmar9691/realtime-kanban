import mongoose from "mongoose";
import Board from "../models/Board.js";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Loads a board and verifies the authenticated user may access it.
// Boards created before authentication (no owner) stay accessible to any
// authenticated user so existing data is preserved.
export async function loadBoardForUser(boardId, user, { ownerOnly = false } = {}) {
  if (!mongoose.isObjectIdOrHexString(boardId)) {
    throw new HttpError(400, "Invalid board ID");
  }

  const board = await Board.findById(boardId);

  if (!board) {
    throw new HttpError(404, "Board not found");
  }

  if (!board.owner) {
    return board;
  }

  const userId = String(user._id);
  const isOwner = String(board.owner) === userId;
  const isMember = (board.memberIds || []).some((id) => String(id) === userId);

  if (ownerOnly && !isOwner) {
    throw new HttpError(403, "Only the board owner can do this");
  }

  if (!isOwner && !isMember) {
    throw new HttpError(403, "You do not have access to this board");
  }

  return board;
}

// Builds the query used to list every board a user can access.
export function accessibleBoardFilter(user) {
  const userId = user._id;
  return {
    $or: [
      { owner: userId },
      { memberIds: userId },
      { owner: { $exists: false } },
      { owner: null },
    ],
  };
}
