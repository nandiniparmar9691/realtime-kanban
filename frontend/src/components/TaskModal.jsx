import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { socket } from "../socket.js";
import { formatDateTime, formatFileSize, initials } from "../utils/format.js";

const initialForm = {
  title: "",
  description: "",
  priority: "Medium",
  dueDate: "",
  assignedTo: "",
  status: "Todo",
};

export default function TaskModal({
  task,
  members,
  saving,
  memberName,
  onSave,
  onClose,
  onTyping,
  onTypingStop,
  onChanged,
}) {
  const [form, setForm] = useState(initialForm);
  const [attachments, setAttachments] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentSending, setCommentSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modalError, setModalError] = useState("");
  const typingTimer = useRef(null);
  const fileInput = useRef(null);

  const taskId = task?._id || null;

  useEffect(() => {
    setForm(
      task
        ? {
            title: task.title || "",
            description: task.description || "",
            priority: task.priority || "Medium",
            dueDate: task.dueDate
              ? new Date(task.dueDate).toISOString().slice(0, 10)
              : "",
            assignedTo: task.assignedTo || "",
            status: task.status || "Todo",
          }
        : initialForm
    );
    setAttachments(task?.attachments || []);
    setCommentText("");
    setModalError("");
  }, [task]);

  useEffect(() => {
    if (!taskId) {
      setComments([]);
      return;
    }

    let active = true;
    setCommentsLoading(true);

    api(`/tasks/${taskId}/comments`)
      .then((data) => {
        if (active) setComments(data);
      })
      .catch((err) => {
        if (active) setModalError(err.message);
      })
      .finally(() => {
        if (active) setCommentsLoading(false);
      });

    const handleNewComment = (payload) => {
      if (String(payload.taskId) !== String(taskId)) return;
      setComments((current) =>
        current.some((c) => c._id === payload.comment._id)
          ? current
          : [...current, payload.comment]
      );
    };

    socket.on("comment:new", handleNewComment);
    return () => {
      active = false;
      socket.off("comment:new", handleNewComment);
    };
  }, [taskId]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

  function signalTyping() {
    onTyping?.();
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      typingTimer.current = null;
      onTypingStop?.();
    }, 1500);
  }

  function change(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    signalTyping();
  }

  function submit(event) {
    event.preventDefault();
    if (!form.title.trim()) return;

    if (typingTimer.current) clearTimeout(typingTimer.current);
    onTypingStop?.();
    onSave({
      ...form,
      title: form.title.trim(),
      dueDate: form.dueDate || null,
    });
  }

  async function addComment(event) {
    event.preventDefault();
    if (!taskId || !commentText.trim()) return;

    setCommentSending(true);
    setModalError("");
    try {
      const created = await api(`/tasks/${taskId}/comments`, {
        method: "POST",
        body: JSON.stringify({ author: memberName, text: commentText.trim() }),
      });
      setComments((current) =>
        current.some((c) => c._id === created._id)
          ? current
          : [...current, created]
      );
      setCommentText("");
      onChanged?.();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setCommentSending(false);
    }
  }

  async function uploadFile(event) {
    const file = event.target.files?.[0];
    if (!file || !taskId) return;

    setUploading(true);
    setModalError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("uploadedBy", memberName || "Guest");
      const updated = await api(`/tasks/${taskId}/attachments`, {
        method: "POST",
        body: formData,
      });
      setAttachments(updated.attachments || []);
      onChanged?.();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeAttachment(attachmentId) {
    if (!taskId) return;
    if (!window.confirm("Remove this attachment?")) return;

    setModalError("");
    try {
      const updated = await api(
        `/tasks/${taskId}/attachments/${attachmentId}`,
        { method: "DELETE" }
      );
      setAttachments(updated.attachments || []);
      onChanged?.();
    } catch (err) {
      setModalError(err.message);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="task-modal"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <h2>{task ? "Edit task" : "Create task"}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {modalError && <div className="alert error compact">{modalError}</div>}

        <label>
          Title *
          <input
            name="title"
            value={form.title}
            onChange={change}
            required
            maxLength={200}
            autoFocus
          />
        </label>

        <label>
          Description
          <textarea
            name="description"
            value={form.description}
            onChange={change}
            rows="3"
            maxLength={5000}
          />
        </label>

        <div className="form-row">
          <label>
            Priority
            <select name="priority" value={form.priority} onChange={change}>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </label>

          <label>
            Status
            <select name="status" value={form.status} onChange={change}>
              <option>Todo</option>
              <option>In Progress</option>
              <option>Review</option>
              <option>Done</option>
            </select>
          </label>
        </div>

        <label>
          Assigned member
          <input
            name="assignedTo"
            list="board-members"
            value={form.assignedTo}
            onChange={change}
            placeholder="Enter member name"
            maxLength={50}
          />
          <datalist id="board-members">
            {members.map((member) => (
              <option key={member} value={member} />
            ))}
          </datalist>
        </label>

        <label>
          Due date
          <input
            type="date"
            name="dueDate"
            value={form.dueDate}
            onChange={change}
          />
        </label>

        {task && (
          <section className="modal-section">
            <h3>Attachments</h3>

            {attachments.length > 0 && (
              <ul className="attachment-list">
                {attachments.map((file) => (
                  <li key={file._id || file.url}>
                    <a href={file.url} target="_blank" rel="noreferrer">
                      {file.name}
                    </a>
                    <span className="muted">{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => removeAttachment(file._id)}
                      aria-label={`Remove ${file.name}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <label className="upload-control">
              <input
                ref={fileInput}
                type="file"
                onChange={uploadFile}
                disabled={uploading}
              />
              <span className="secondary">
                {uploading ? "Uploading…" : "＋ Add attachment"}
              </span>
            </label>
            <p className="muted small">
              Max 5MB · images, PDF, docs, spreadsheets, zip
            </p>
          </section>
        )}

        {task && (
          <section className="modal-section">
            <h3>Comments ({comments.length})</h3>

            <div className="comment-list">
              {commentsLoading && <p className="muted small">Loading comments…</p>}
              {!commentsLoading && comments.length === 0 && (
                <p className="muted small">No comments yet.</p>
              )}
              {comments.map((comment) => (
                <div className="comment" key={comment._id}>
                  <span className="comment-avatar" aria-hidden="true">
                    {initials(comment.author)}
                  </span>
                  <div className="comment-body">
                    <div className="comment-head">
                      <strong>{comment.author}</strong>
                      <span className="muted small">
                        {formatDateTime(comment.createdAt)}
                      </span>
                    </div>
                    <p>{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="comment-form">
              <input
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="Write a comment…"
                maxLength={1000}
                disabled={commentSending}
              />
              <button
                type="button"
                className="secondary"
                onClick={addComment}
                disabled={commentSending || !commentText.trim()}
              >
                {commentSending ? "Posting…" : "Comment"}
              </button>
            </div>
          </section>
        )}

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Saving…" : "Save task"}
          </button>
        </div>
      </form>
    </div>
  );
}
