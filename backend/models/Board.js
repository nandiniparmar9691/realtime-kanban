import mongoose from "mongoose";

const boardSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    members: {
      type: [{ type: String, trim: true, maxlength: 50 }],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Board", boardSchema);