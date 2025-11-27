const mongoose = require("mongoose");

const sosAlertSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Temporarily optional for testing
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: false, // 🔹 make optional temporarily
    },

    category: {
      type: String,
      enum: ["Security", "General", "Office"],
      required: true,
    },

    type: {
      type: String,
      enum: [
        "Medical",
        "Fire",
        "Accident",
        "Technical Fault",
        "Hazard",
        "Other",
        "Fight",
        "Theft",
        "Intrusion",
        "Harassment",
        "Violence",
        "Suspicious Movement",
        "Panic Alert",
        "Power Failure",
        "Network Outage",
        "System Downtime",
        "Building Issue",
        "Visitor Incident",
        "Office Disturbance"
      ],
      required: true,
    },

    message: {
      type: String,
      trim: true,
    },

    location: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["Pending", "Responding", "Resolved"],
      default: "Pending",
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    notifyRoles: {
      type: [String],
      enum: ["admin", "subadmin", "staff", "stakeholder"],
      default: ["admin", "subadmin"],
    },

    notes: [
      {
        note: String,
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        addedAt: { type: Date, default: Date.now },
      }
    ],

    attachments: [
      {
        url: String,
        uploadedAt: { type: Date, default: Date.now }
      }
    ],

    resolvedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SOSAlert", sosAlertSchema);