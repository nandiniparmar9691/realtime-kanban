export const emitBoardChanged = (req, boardId) => {
  const io = req.app.get("io");

  if (!io) return;

  const payload = {
    boardId: String(boardId),
    updatedAt: new Date().toISOString(),
  };

  io.to(`board:${boardId}`).emit("board:changed", payload);

  // Keep the dashboard (which is not in a board room) in sync too.
  io.emit("dashboard:changed", payload);
};
