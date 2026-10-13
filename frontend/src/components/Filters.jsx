export default function Filters({
  priority,
  setPriority,
  member,
  setMember,
  dueDate,
  setDueDate,
  members,
}) {
  return (
    <div className="filters">
      <select
        value={priority}
        onChange={(event) => setPriority(event.target.value)}
      >
        <option value="All">All priorities</option>
        <option value="High">High priority</option>
        <option value="Medium">Medium priority</option>
        <option value="Low">Low priority</option>
      </select>

      <select
        value={member}
        onChange={(event) => setMember(event.target.value)}
      >
        <option value="All">All members</option>
        {members.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>

      <input
        aria-label="Filter by due date"
        type="date"
        value={dueDate}
        onChange={(event) => setDueDate(event.target.value)}
      />

      <button
        type="button"
        className="secondary"
        onClick={() => {
          setPriority("All");
          setMember("All");
          setDueDate("");
        }}
      >
        Clear filters
      </button>
    </div>
  );
}