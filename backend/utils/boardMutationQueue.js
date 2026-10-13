const boardQueues = new Map();

export async function withBoardMutationLock(boardId, mutation) {
  const key = String(boardId);
  const previous = boardQueues.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);

  boardQueues.set(key, queued);
  await previous;

  try {
    return await mutation();
  } finally {
    release();
    if (boardQueues.get(key) === queued) {
      boardQueues.delete(key);
    }
  }
}
