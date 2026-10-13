import { formatRelativeTime, initials } from "../utils/format.js";

const TYPE_LABELS = {
  board_created: "Board created",
  member_added: "Member added",
  task_created: "Task created",
  task_updated: "Task updated",
  task_moved: "Task moved",
  task_deleted: "Task deleted",
  task_assigned: "Task assigned",
  comment_added: "Comment added",
  attachment_added: "Attachment added",
};

export default function ActivityTimeline({
  activities = [],
  loading = false,
  error = "",
  showBoard = false,
  emptyMessage = "No activity yet.",
}) {
  if (loading) {
    return (
      <div className="timeline-skeleton" aria-busy="true">
        {[0, 1, 2, 3].map((row) => (
          <div className="skeleton-line" key={row} />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="empty-state">{error}</p>;
  }

  if (!activities.length) {
    return <p className="empty-state">{emptyMessage}</p>;
  }

  return (
    <ol className="activity-timeline">
      {activities.map((activity) => (
        <li className={`activity-item ${activity.type}`} key={activity._id}>
          <span className="activity-avatar" aria-hidden="true">
            {initials(activity.actor)}
          </span>
          <div className="activity-body">
            <p className="activity-text">
              <strong>{activity.actor || "Guest"}</strong> {activity.message}
            </p>
            <div className="activity-meta">
              <span className="activity-type">
                {TYPE_LABELS[activity.type] || "Activity"}
              </span>
              {showBoard && activity.board?.title && (
                <span className="activity-board">{activity.board.title}</span>
              )}
              <span className="activity-time">
                {formatRelativeTime(activity.createdAt)}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
