const mongoose = require("mongoose");

const clientEmailSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    company: { type: String, required: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, default: "" }, // optional client name
    category: { type: String, default: "General" }, // new field for categorization
  },
  { timestamps: true }
);

module.exports = mongoose.model("ClientEmail", clientEmailSchema);