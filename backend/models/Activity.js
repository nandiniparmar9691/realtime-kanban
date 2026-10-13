import mongoose from "mongoose";

const ACTIVITY_TYPES = [
  "board_created",
  "member_added",
  "task_created",
  "task_updated",
  "task_moved",
  "task_deleted",
  "task_assigned",
  "comment_added",
  "attachment_added",
];

const activitySchema = new mongoose.Schema(
  {
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    type: {
      type: String,
      enum: ACTIVITY_TYPES,
      required: true,
    },
    actor: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "Guest",
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    meta: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

activitySchema.index({ board: 1, createdAt: -1 });

export const ACTIVITY = ACTIVITY_TYPES;

export default mongoose.model("Activity", activitySchema);
