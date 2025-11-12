const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    staffName: { type: String, required: true },
    department: { type: String, required: true },
    designation: { type: String, required: true },
    weekEnding: { type: Date, required: true },
    summary: { type: String, required: true }, // Summary of weekly activities
    tasksCompleted: [{ type: String }], // Array of completed tasks
    tasksInProgress: [{ type: String }], // Array of in-progress tasks
    challenges: { type: String, default: "" },
    nextWeekTargets: { type: String, default: "" },
    supportNeeded: { type: String, default: "" },
    supervisorComment: { type: String, default: "" },
    dateSubmitted: { type: Date, default: Date.now }, // Auto-generated timestamp
    fileUploads: [{ type: String }], // URLs to uploaded files
    performanceRating: {
      type: String,
      enum: ["Excellent", "Good", "Fair", "Poor"],
      default: "Good",
    },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const Report = mongoose.model("Report", reportSchema);
module.exports = { Report };