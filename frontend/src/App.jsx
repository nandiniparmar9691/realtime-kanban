import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";
import { socket } from "./socket.js";
import { useAuth } from "./contexts/auth-context.js";
import KanbanColumn from "./components/KanbanColumn.jsx";
import TaskModal from "./components/TaskModal.jsx";
import Filters from "./components/Filters.jsx";
import Dashboard from "./components/Dashboard.jsx";
import ActivityTimeline from "./components/ActivityTimeline.jsx";

const STATUSES = ["Todo", "In Progress", "Review", "Done"];

function applyMove(list, taskId, status, position) {
  const moved = list.find((task) => task._id === taskId);
  if (!moved) return list;

  const remaining = list.filter((task) => task._id !== taskId);
  const columns = {};
  for (const columnStatus of STATUSES) {
    columns[columnStatus] = remaining
      .filter((task) => task.status === columnStatus)
      .sort((a, b) => a.position - b.position);
  }

  const target = columns[status] || (columns[status] = []);
  const clamped = Math.max(0, Math.min(position, target.length));
  target.splice(clamped, 0, { ...moved, status });

  const positions = new Map();
  for (const columnStatus of STATUSES) {
    columns[columnStatus].forEach((task, index) => {
      positions.set(task._id, { position: index, status: columnStatus });
    });
  }

  return list
    .map((task) => {
      const info = positions.get(task._id);
      return info ? { ...task, position: info.position, status: info.status } : task;
    })
    .sort(
      (a, b) =>
        STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) ||
        a.position - b.position
    );
}

export default function App() {
  const { user, logout } = useAuth();
  const [boards, setBoards] = useState([]);
  const [board, setBoard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [memberName, setMemberName] = useState(
    () => user?.name || localStorage.getItem("kanban:memberName") || "Teammate"
  );
  const [onlineMembers, setOnlineMembers] = useState([]);
  const [typingMembers, setTypingMembers] = useState([]);

  const [view, setView] = useState("dashboard");
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [newMember, setNewMember] = useState("");
  const [modalTask, setModalTask] = useState(undefined);

  const [priority, setPriority] = useState("All");
  const [member, setMember] = useState("All");
  const [dueDate, setDueDate] = useState("");

  const [boardsLoading, setBoardsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const boardRequestId = useRef(0);
  const selectedBoardId = useRef(null);

  useEffect(() => {
    localStorage.setItem("kanban:memberName", memberName);
  }, [memberName]);

  const refreshBoards = useCallback(async () => {
    try {
      const data = await api("/boards");
      setBoards(data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBoardsLoading(false);
    }
  }, []);

  const refreshBoard = useCallback(async (boardId) => {
    if (!boardId) return false;

    const requestedBoardId = String(boardId);
    const requestId = ++boardRequestId.current;
    selectedBoardId.current = requestedBoardId;

    try {
      const [data, activity] = await Promise.all([
        api(`/boards/${boardId}`),
        api(`/boards/${boardId}/activity`).catch(() => []),
      ]);

      if (
        requestId !== boardRequestId.current ||
        selectedBoardId.current !== requestedBoardId
      ) {
        return false;
      }

      setBoard(data.board);
      setTasks(data.tasks);
      setActivities(activity);
      setError("");
      return true;
    } catch (err) {
      if (requestId === boardRequestId.current) setError(err.message);
      return false;
    }
  }, []);

  useEffect(() => {
    refreshBoards();
  }, [refreshBoards]);

  // Join the selected board and synchronize after changes/reconnection.
  useEffect(() => {
    if (!board?._id) return;

    const boardId = board._id;
    setOnlineMembers([]);
    setTypingMembers([]);

    const joinBoard = () => {
      if (selectedBoardId.current !== String(boardId)) return;
      socket.emit("board:join", { boardId, memberName });
      refreshBoard(boardId);
    };

    const handleBoardChanged = (event) => {
      if (
        String(event.boardId) === String(boardId) &&
        selectedBoardId.current === String(boardId)
      ) {
        refreshBoard(boardId);
        refreshBoards();
      }
    };

    const handleMembers = (event) => {
      if (
        String(event.boardId) === String(boardId) &&
        selectedBoardId.current === String(boardId)
      ) {
        setOnlineMembers(event.onlineMembers || []);
      }
    };

    const handleTyping = ({ boardId: eventBoardId, memberName: name, typing }) => {
      if (String(eventBoardId) !== String(boardId)) return;
      if (!name || name === memberName) return;

      setTypingMembers((current) =>
        typing
          ? [...new Set([...current, name])]
          : current.filter((person) => person !== name)
      );
    };

    socket.on("connect", joinBoard);
    socket.on("board:changed", handleBoardChanged);
    socket.on("members:changed", handleMembers);
    socket.on("typing:update", handleTyping);

    if (!socket.connected) socket.connect();
    else joinBoard();

    return () => {
      socket.off("connect", joinBoard);
      socket.off("board:changed", handleBoardChanged);
      socket.off("members:changed", handleMembers);
      socket.off("typing:update", handleTyping);
      socket.emit("board:leave", { boardId });
    };
  }, [board?._id, memberName, refreshBoard, refreshBoards]);

  async function createBoard(event) {
    event.preventDefault();

    if (!newBoardTitle.trim() || !memberName.trim()) return;

    setLoading(true);
    setError("");

    try {
      const created = await api("/boards", {
        method: "POST",
        body: JSON.stringify({
          title: newBoardTitle.trim(),
          createdBy: memberName.trim(),
        }),
      });

      setNewBoardTitle("");
      await refreshBoards();
      boardRequestId.current += 1;
      selectedBoardId.current = String(created._id);
      setBoard(created);
      setTasks([]);
      setActivities([]);
      setView("board");
      setNotice("Board created successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectBoard(boardId) {
    if (!boardId) {
      boardRequestId.current += 1;
      selectedBoardId.current = null;
      setBoard(null);
      setTasks([]);
      setActivities([]);
      setOnlineMembers([]);
      setTypingMembers([]);
      return;
    }

    const requestedBoardId = String(boardId);
    const previousBoardId = board?._id ? String(board._id) : null;
    selectedBoardId.current = requestedBoardId;
    const refreshed = await refreshBoard(boardId);

    if (!refreshed && selectedBoardId.current === requestedBoardId) {
      selectedBoardId.current = previousBoardId;
    }
  }

  async function openBoard(boardId) {
    setView("board");
    await selectBoard(boardId);
  }

  async function saveTask(form) {
    if (!board?._id) return;

    setLoading(true);
    setError("");

    try {
      if (modalTask?._id) {
        await api(`/tasks/${modalTask._id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...form, actor: memberName }),
        });
      } else {
        await api(`/boards/${board._id}/tasks`, {
          method: "POST",
          body: JSON.stringify({
            ...form,
            createdBy: memberName,
          }),
        });
      }

      typingStop();
      setModalTask(undefined);
      await refreshBoard(board._id);
      setNotice("Task saved successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteTask(task) {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;

    setDeletingTaskId(task._id);
    try {
      await api(`/tasks/${task._id}`, {
        method: "DELETE",
        body: JSON.stringify({ actor: memberName }),
      });
      await refreshBoard(board._id);
      setNotice("Task deleted");
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingTaskId(null);
    }
  }

  function dragStart(event, task) {
    event.dataTransfer.setData("taskId", task._id);
    event.dataTransfer.effectAllowed = "move";
  }

  async function dropTask(event, status, beforeTaskId) {
    event.preventDefault();

    const taskId = event.dataTransfer.getData("taskId");
    const draggedTask = tasks.find((task) => task._id === taskId);

    if (!draggedTask) return;

    const columnWithoutDragged = tasks
      .filter((task) => task.status === status && task._id !== taskId)
      .sort((a, b) => a.position - b.position);

    let position = columnWithoutDragged.length;
    if (beforeTaskId && beforeTaskId !== taskId) {
      const index = columnWithoutDragged.findIndex(
        (task) => task._id === beforeTaskId
      );
      if (index !== -1) position = index;
    }

    setTasks((current) => applyMove(current, taskId, status, position));

    try {
      await api(`/tasks/${taskId}/move`, {
        method: "PATCH",
        body: JSON.stringify({ status, position, actor: memberName }),
      });

      await refreshBoard(board._id);
    } catch (err) {
      setError(err.message);
      await refreshBoard(board._id);
    }
  }

  async function inviteMember(event) {
    event.preventDefault();

    if (!newMember.trim() || !board?._id) return;

    setInviteLoading(true);
    try {
      const updatedBoard = await api(`/boards/${board._id}/members`, {
        method: "POST",
        body: JSON.stringify({ memberEmail: newMember.trim() }),
      });

      setBoard(updatedBoard);
      setNewMember("");
      setNotice("Member added to the board");
    } catch (err) {
      setError(err.message);
    } finally {
      setInviteLoading(false);
    }
  }

  function typingStart() {
    if (board?._id && socket.connected) {
      socket.emit("typing:start", { boardId: board._id });
    }
  }

  function typingStop() {
    if (board?._id && socket.connected) {
      socket.emit("typing:stop", { boardId: board._id });
    }
  }

  function closeTaskModal() {
    typingStop();
    setModalTask(undefined);
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesPriority = priority === "All" || task.priority === priority;
      const matchesMember = member === "All" || task.assignedTo === member;
      const matchesDate =
        !dueDate ||
        (task.dueDate &&
          new Date(task.dueDate).toISOString().slice(0, 10) === dueDate);

      return matchesPriority && matchesMember && matchesDate;
    });
  }, [tasks, priority, member, dueDate]);

  const members = useMemo(
    () => [
      ...new Set([
        ...(board?.members || []),
        ...tasks.map((task) => task.assignedTo).filter(Boolean),
      ]),
    ],
    [board, tasks]
  );

  const completedCount = tasks.filter((task) => task.status === "Done").length;
  const hasActiveFilters =
    priority !== "All" || member !== "All" || dueDate !== "";

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">TEAM WORKSPACE</p>
          <h1>
            FlowBoard <span>●</span>
          </h1>
          <p className="subtitle">Plan together. Move work forward.</p>
        </div>

        <div className="header-actions">
          <nav className="app-nav" aria-label="Primary">
            <button
              className={view === "dashboard" ? "nav-button active" : "nav-button"}
              onClick={() => setView("dashboard")}
            >
              Dashboard
            </button>
            <button
              className={view === "board" ? "nav-button active" : "nav-button"}
              onClick={() => setView("board")}
            >
              Board
            </button>
          </nav>

          <label className="member-input">
            Your display name
            <input
              value={memberName}
              onChange={(event) => setMemberName(event.target.value)}
              maxLength={50}
            />
          </label>

          <div className="user-box">
            <button className="secondary small" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="alert error">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}

      {notice && (
        <div className="alert success">
          {notice}
          <button onClick={() => setNotice("")}>Dismiss</button>
        </div>
      )}

      {view === "dashboard" && (
        <Dashboard memberName={memberName} onOpenBoard={openBoard} />
      )}

      {view === "board" && (
        <>
          <section className="workspace-panel">
            <form className="create-board-form" onSubmit={createBoard}>
              <label>
                Create a board
                <input
                  placeholder="e.g. Product launch"
                  value={newBoardTitle}
                  onChange={(event) => setNewBoardTitle(event.target.value)}
                  maxLength={100}
                  required
                />
              </label>
              <button className="primary" disabled={loading}>
                {loading ? "Please wait…" : "＋ Create board"}
              </button>
            </form>

            <label className="board-selector">
              Select board
              <select
                value={board?._id || ""}
                onChange={(event) => selectBoard(event.target.value)}
                disabled={boardsLoading}
              >
                <option value="">
                  {boardsLoading ? "Loading boards…" : "Choose a board"}
                </option>
                {boards.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {!board ? (
            <section className="welcome-panel">
              <div className="welcome-icon">▦</div>
              <h2>Your team's work, in one place.</h2>
              <p>Create a board or select an existing board to get started.</p>
            </section>
          ) : (
            <>
              <section className="board-heading">
                <div>
                  <p className="eyebrow">CURRENT BOARD</p>
                  <h2>{board.title}</h2>
                  <p className="muted">
                    Created by {board.createdBy} · {tasks.length} tasks ·{" "}
                    {completedCount} completed
                  </p>
                </div>

                <button className="primary" onClick={() => setModalTask(null)}>
                  ＋ Add task
                </button>
              </section>

              <section className="collaboration-bar">
                <div className="online-status">
                  <span className="online-dot" />
                  <strong>{onlineMembers.length}</strong> online
                  <span className="online-names">
                    {onlineMembers.join(", ") || "Waiting for teammates"}
                  </span>
                </div>

                {typingMembers.length > 0 && (
                  <span className="typing-indicator">
                    {typingMembers.join(", ")} typing…
                  </span>
                )}

                <form className="invite-form" onSubmit={inviteMember}>
                  <input
                    type="email"
                    placeholder="Member email"
                    value={newMember}
                    onChange={(event) => setNewMember(event.target.value)}
                    maxLength={120}
                    required
                  />
                  <button className="secondary" disabled={inviteLoading}>
                    {inviteLoading ? "Adding…" : "＋ Add member"}
                  </button>
                </form>
              </section>

              <Filters
                priority={priority}
                setPriority={setPriority}
                member={member}
                setMember={setMember}
                dueDate={dueDate}
                setDueDate={setDueDate}
                members={members}
              />

              {hasActiveFilters && (
                <p className="filter-summary">
                  Showing {filteredTasks.length} of {tasks.length} tasks
                </p>
              )}

              <section className="kanban-board">
                {STATUSES.map((status) => (
                  <KanbanColumn
                    key={status}
                    status={status}
                    tasks={filteredTasks.filter((task) => task.status === status)}
                    onEdit={(task) => setModalTask(task)}
                    onDragStart={dragStart}
                    onDrop={dropTask}
                  />
                ))}
              </section>

              <section className="board-lower-grid">
                <article className="panel">
                  <header className="panel-header">
                    <h3>Manage tasks</h3>
                    <span className="panel-hint">{tasks.length} total</span>
                  </header>
                  <p className="muted small">
                    Edit any card or delete tasks below.
                  </p>
                  {tasks.length === 0 && (
                    <p className="empty-state">
                      No tasks on this board yet. Add your first task.
                    </p>
                  )}
                  {tasks.map((task) => (
                    <div className="manage-row" key={task._id}>
                      <div>
                        <strong>{task.title}</strong>
                        <span className="muted"> · {task.status}</span>
                      </div>
                      <button
                        className="danger-button"
                        onClick={() => deleteTask(task)}
                        disabled={deletingTaskId !== null}
                      >
                        {deletingTaskId === task._id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  ))}
                </article>

                <article className="panel">
                  <header className="panel-header">
                    <h3>Activity</h3>
                    <span className="panel-hint">Live</span>
                  </header>
                  <ActivityTimeline activities={activities} />
                </article>
              </section>
            </>
          )}
        </>
      )}

      {modalTask !== undefined && (
        <TaskModal
          task={modalTask}
          members={members}
          saving={loading}
          memberName={memberName}
          onSave={saveTask}
          onClose={closeTaskModal}
          onTyping={typingStart}
          onTypingStop={typingStop}
          onChanged={() => board?._id && refreshBoard(board._id)}
        />
      )}
    </main>
  );
}
