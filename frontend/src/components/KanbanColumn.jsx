import { useState } from "react";
import TaskCard from "./TaskCard.jsx";

export default function KanbanColumn({
  status,
  tasks,
  onEdit,
  onDragStart,
  onDrop,
}) {
  const [overIndex, setOverIndex] = useState(null);

  function handleDragOver(event, index) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setOverIndex(index);
  }

  function handleDrop(event) {
    event.preventDefault();
    const beforeTaskId =
      overIndex !== null && overIndex < tasks.length
        ? tasks[overIndex]?._id || null
        : null;
    setOverIndex(null);
    onDrop(event, status, beforeTaskId);
  }

  return (
    <section
      className="kanban-column"
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setOverIndex(null)}
      onDrop={handleDrop}
    >
      <header className="column-header">
        <h2>{status}</h2>
        <span className="task-count">{tasks.length}</span>
      </header>

      <div className="task-list">
        {tasks.map((task, index) => (
          <div
            className={`task-slot${overIndex === index ? " drop-before" : ""}`}
            key={task._id}
            onDragOver={(event) => handleDragOver(event, index)}
          >
            <TaskCard
              task={task}
              onEdit={onEdit}
              onDragStart={onDragStart}
            />
          </div>
        ))}

        <div
          className={`drop-end${overIndex === tasks.length ? " active" : ""}`}
          onDragOver={(event) => handleDragOver(event, tasks.length)}
        />

        {tasks.length === 0 && (
          <p className="empty-column">Drop a task here</p>
        )}
      </div>
    </section>
  );
}
