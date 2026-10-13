import { formatDate, isOverdue } from "../utils/format.js";

export default function TaskCard({ task, onEdit, onDragStart }) {
  const overdue = isOverdue(task.dueDate, task.status);
  const attachmentCount = task.attachments?.length || 0;

  return (
    <article
      className={`task-card priority-${task.priority.toLowerCase()}${
        overdue ? " overdue" : ""
      }`}
      draggable
      onDragStart={(event) => onDragStart(event, task)}
    >
      <div className="task-card-top">
        <span className={`priority ${task.priority.toLowerCase()}`}>
          {task.priority}
        </span>

        <button
          className="edit-button"
          onClick={() => onEdit(task)}
          aria-label={`Edit ${task.title}`}
        >
          Edit
        </button>
      </div>

      <h3>{task.title}</h3>

      {task.description && <p className="task-description">{task.description}</p>}

      <div className="task-meta">
        <span title="Assigned member">👤 {task.assignedTo || "Unassigned"}</span>
        {task.dueDate && (
          <span className={overdue ? "due-overdue" : ""} title="Due date">
            📅 {formatDate(task.dueDate)}
          </span>
        )}
        {attachmentCount > 0 && (
          <span title="Attachments">📎 {attachmentCount}</span>
        )}
      </div>

      {overdue && <span className="overdue-badge">Overdue</span>}
    </article>
  );
}
