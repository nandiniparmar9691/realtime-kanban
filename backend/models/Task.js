import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: "",
      maxlength: 5000,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
    dueDate: {
      type: Date,
      default: null,
    },
    assignedTo: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "",
    },
    status: {
      type: String,
      enum: ["Todo", "In Progress", "Review", "Done"],
      default: "Todo",
    },
    position: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "Guest",
    },
    attachments: {
      type: [
        {
          name: { type: String, trim: true, maxlength: 255 },
          url: { type: String, trim: true },
          size: { type: Number, default: 0, min: 0 },
          mimetype: { type: String, trim: true, default: "" },
          uploadedBy: { type: String, trim: true, maxlength: 50, default: "Guest" },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

taskSchema.index({ board: 1, status: 1, position: 1 });

export default mongoose.model("Task", taskSchema);