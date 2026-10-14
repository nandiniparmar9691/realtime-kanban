import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { socket } from "../socket.js";
import ActivityTimeline from "./ActivityTimeline.jsx";

const KPI_CARDS = [
  { key: "boards", label: "Total boards", tone: "navy", icon: "▦" },
  { key: "tasks", label: "Total tasks", tone: "primary", icon: "✎" },
  { key: "inProgress", label: "In progress", tone: "primary", icon: "◐" },
  { key: "completed", label: "Completed", tone: "accent", icon: "✓" },
  { key: "overdue", label: "Overdue", tone: "danger", icon: "!" },
  { key: "assigned", label: "Assigned to me", tone: "navy", icon: "★" },
];

function buildCards(data) {
  const totals = data.totals || {};
  const statusCounts = data.statusCounts || {};
  return {
    boards: totals.boards || 0,
    tasks: totals.tasks || 0,
    todo: statusCounts.Todo || 0,
    inProgress: statusCounts["In Progress"] || 0,
    review: statusCounts.Review || 0,
    completed: totals.completed || 0,
    overdue: totals.overdue || 0,
    assigned: data.assigned?.total || 0,
  };
}

function pct(count, counts) {
  const max = Math.max(1, ...Object.values(counts || {}));
  return Math.round((count / max) * 100);
}

export default function Dashboard({ memberName, onOpenBoard }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      try {
        const query = memberName
          ? `?member=${encodeURIComponent(memberName)}`
          : "";
        const result = await api(`/dashboard${query}`);
        setData(result);
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [memberName]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let timer = null;
    const handleChange = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        load({ silent: true });
      }, 400);
    };

    socket.on("dashboard:changed", handleChange);

    // Connect early so the dashboard receives live updates even when no
    // board has been opened yet.
    if (!socket.connected) socket.connect();

    return () => {
      socket.off("dashboard:changed", handleChange);
      if (timer) clearTimeout(timer);
    };
  }, [load]);

  if (loading) {
    return (
      <section className="dashboard">
        <div className="dash-kpis">
          {KPI_CARDS.map((card) => (
            <div className="kpi skeleton" key={card.key} />
          ))}
        </div>
        <div className="dash-layout">
          <div className="panel skeleton skeleton-tall dash-status" />
          <div className="panel skeleton skeleton-tall dash-priority" />
          <div className="panel skeleton skeleton-tall dash-completion" />
          <div className="panel skeleton skeleton-tall dash-boards" />
          <div className="panel skeleton skeleton-tall dash-workload" />
          <div className="panel skeleton skeleton-tall dash-activity" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="dashboard">
        <div className="dashboard-error">
          <h2>Could not load the dashboard</h2>
          <p>{error}</p>
          <button className="primary" onClick={() => load()}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (!data) return null;

  const cards = buildCards(data);
  const hasTasks = (data.totals.tasks || 0) > 0;
  const completionRate = data.totals.tasks
    ? Math.round((data.totals.completed / data.totals.tasks) * 100)
    : 0;

  return (
    <section className="dashboard">
      <div className="dash-head">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h2>Project dashboard</h2>
          <p className="muted">
            Live metrics across every board
            {memberName ? ` · viewing as ${memberName}` : ""}
          </p>
        </div>
        <button
          className="secondary"
          onClick={() => load({ silent: true })}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      <div className="dash-kpis">
        {KPI_CARDS.map((card) => (
          <article className={`kpi ${card.tone}`} key={card.key}>
            <span className="kpi-icon" aria-hidden="true">
              {card.icon}
            </span>
            <div className="kpi-body">
              <strong>{cards[card.key]}</strong>
              <span>{card.label}</span>
            </div>
          </article>
        ))}
      </div>

      {!hasTasks && (
        <div className="empty-banner">
          No tasks have been created yet. Open a board and add your first task to
          populate the analytics.
        </div>
      )}

      <div className="dash-layout">
        <article className="panel dash-status">
          <header className="panel-header">
            <h3>Tasks by status</h3>
            <span className="panel-hint">Distribution</span>
          </header>
          <div className="bar-chart">
            {Object.entries(data.statusCounts || {}).map(([status, count]) => (
              <div className="bar-row" key={status}>
                <span className="bar-label">{status}</span>
                <div className="bar-track">
                  <div
                    className={`bar-fill status-${status
                      .toLowerCase()
                      .replace(/\s+/g, "-")}`}
                    style={{ width: `${pct(count, data.statusCounts)}%` }}
                  />
                </div>
                <span className="bar-value">{count}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel dash-priority">
          <header className="panel-header">
            <h3>Tasks by priority</h3>
            <span className="panel-hint">Distribution</span>
          </header>
          <div className="bar-chart">
            {Object.entries(data.priorityCounts || {}).map(
              ([priority, count]) => (
                <div className="bar-row" key={priority}>
                  <span className="bar-label">{priority}</span>
                  <div className="bar-track">
                    <div
                      className={`bar-fill priority-${priority.toLowerCase()}`}
                      style={{ width: `${pct(count, data.priorityCounts)}%` }}
                    />
                  </div>
                  <span className="bar-value">{count}</span>
                </div>
              )
            )}
          </div>
        </article>

        <article className="panel dash-completion">
          <header className="panel-header">
            <h3>Completion</h3>
            <span className="panel-hint">{completionRate}% done</span>
          </header>
          <div className="completion-ring" aria-hidden="true">
            <div
              className="completion-ring-fill"
              style={{
                background: `conic-gradient(var(--accent) ${completionRate}%, #d5dced ${completionRate}% 100%)`,
              }}
            >
              <span>{completionRate}%</span>
            </div>
          </div>
          <div className="completion-legend">
            <span>
              <i className="dot done" /> Completed {data.totals.completed}
            </span>
            <span>
              <i className="dot pending" /> Pending {data.totals.pending}
            </span>
          </div>
        </article>

        <article className="panel dash-boards">
          <header className="panel-header">
            <h3>Boards</h3>
            <span className="panel-hint">{data.boards.length} total</span>
          </header>

          {data.boards.length === 0 ? (
            <p className="empty-state">
              No boards yet. Create one from the Board tab to get started.
            </p>
          ) : (
            <div className="board-list scroll-area">
              {data.boards.map((board) => (
                <div className="board-row" key={board._id}>
                  <div className="board-row-main">
                    <strong>{board.title}</strong>
                    <span className="muted">
                      {board.memberCount} member
                      {board.memberCount === 1 ? "" : "s"} · {board.taskCount} task
                      {board.taskCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="board-progress">
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${board.progress}%` }}
                      />
                    </div>
                    <span>{board.progress}%</span>
                  </div>
                  <button
                    className="primary small"
                    onClick={() => onOpenBoard(board._id)}
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel dash-workload">
          <header className="panel-header">
            <h3>My workload</h3>
            <span className="panel-hint">{data.assigned.member || "No user"}</span>
          </header>
          {data.assigned.member ? (
            <div className="workload">
              <strong>{data.assigned.total}</strong>
              <span className="muted">tasks assigned</span>
              <div className="workload-split">
                <span className="chip accent">{data.assigned.open} open</span>
                <span className="chip">
                  {data.assigned.total - data.assigned.open} done
                </span>
              </div>
            </div>
          ) : (
            <p className="empty-state">
              Set your display name to see tasks assigned to you.
            </p>
          )}
        </article>

        <article className="panel dash-activity">
          <header className="panel-header">
            <h3>Recent activity</h3>
            <span className="panel-hint">Latest updates</span>
          </header>
          <div className="scroll-area">
            <ActivityTimeline activities={data.recentActivity} showBoard />
          </div>
        </article>
      </div>
    </section>
  );
}
