const express = require("express");
const router = express.Router();
const { Report } = require("../models/Report");
const { auth, isAdmin, isStaff } = require("../middleware/auth");

// ----- GET ALL REPORTS ----- (Admins only)
router.get("/", isAdmin, async (req, res) => {
  console.log("📌 [GET /reports] Request received by admin:", req.user?.email);
  try {
    const reports = await Report.find()
      .sort({ date: -1 })
      .populate("submittedBy", "name email");
    console.log(`✅ [GET /reports] Returning ${reports.length} reports`);
    res.status(200).json(reports);
  } catch (error) {
    console.error("❌ [GET /reports] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// ----- GET SINGLE REPORT ----- (Admins or the staff who submitted)
router.get("/:id", auth, async (req, res) => {
  console.log(`📌 [GET /reports/${req.params.id}] Request by: ${req.user?.email}`);
  try {
    const report = await Report.findById(req.params.id).populate("submittedBy", "name email");
    if (!report) {
      console.log("⚠️ Report not found");
      return res.status(404).json({ message: "Report not found" });
    }

    if (
      report.submittedBy &&
      report.submittedBy._id.toString() !== req.user._id &&
      !req.user.isAdmin
    ) {
      console.log("❌ Access denied for", req.user?.email);
      return res.status(403).json({ message: "Access denied" });
    }

    console.log("✅ Report fetched:", report._id);
    res.status(200).json(report);
  } catch (error) {
    console.error(`❌ [GET /reports/${req.params.id}] Error:`, error.message);
    res.status(500).json({ message: error.message });
  }
});

// ----- CREATE REPORT ----- (Staff only)
// ----- CREATE REPORT ----- (Staff only)
router.post("/", isStaff, async (req, res) => {
  try {
    const {
      department,
      designation,
      weekEnding,
      summary,
      tasksCompleted,
      tasksInProgress,
      challenges,
      nextWeekTargets,
      supportNeeded,
      fileUploads,
    } = req.body;

    if (!department || !designation || !weekEnding || !summary) {
      return res.status(400).json({
        message: "Department, Designation, Week Ending, and Summary are required",
      });
    }

    const report = new Report({
      staffName: req.user.name,
      department,
      designation,
      weekEnding,
      summary,
      tasksCompleted: tasksCompleted || [],
      tasksInProgress: tasksInProgress || [],
      challenges: challenges || "",
      nextWeekTargets: nextWeekTargets || "",
      supportNeeded: supportNeeded || "",
      fileUploads: fileUploads || [],
      supervisorComment: "",        // always empty initially
      performanceRating: "Good",   // default value
      submittedBy: req.user._id,
    });

    const savedReport = await report.save();
    res.status(201).json(savedReport);
  } catch (error) {
    console.error("❌ [POST /reports] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});




// ----- UPDATE REPORT ----- (Staff can only update their own reports)
router.put("/:id", auth, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    if (req.user.isAdmin) {
      // Admin can update supervisorComment and performanceRating
      if (req.body.supervisorComment !== undefined)
        report.supervisorComment = req.body.supervisorComment;
      if (req.body.performanceRating !== undefined)
        report.performanceRating = req.body.performanceRating;
    } else if (req.user._id.toString() === report.submittedBy.toString()) {
      // Staff can only update report content, not rating/comment
      const allowedFields = [
        "department",
        "designation",
        "weekEnding",
        "summary",
        "tasksCompleted",
        "tasksInProgress",
        "challenges",
        "nextWeekTargets",
        "supportNeeded",
        "fileUploads",
      ];
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) report[field] = req.body[field];
      });
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    const updatedReport = await report.save();
    res.status(200).json(updatedReport);
  } catch (error) {
    console.error(`❌ [PUT /reports/:id] Error:`, error.message);
    res.status(500).json({ message: error.message });
  }
});


// ----- DELETE REPORT ----- (Admin only)
router.delete("/:id", isAdmin, async (req, res) => {
  console.log(`📌 [DELETE /reports/${req.params.id}] Delete attempt by admin: ${req.user?.email}`);

  try {
    const deletedReport = await Report.findByIdAndDelete(req.params.id);
    if (!deletedReport) {
      console.log("⚠️ Report not found for deletion");
      return res.status(404).json({ message: "Report not found" });
    }

    console.log("✅ Report deleted:", deletedReport._id);
    res.status(200).json({ message: "Report deleted successfully" });
  } catch (error) {
    console.error(`❌ [DELETE /reports/${req.params.id}] Error:`, error.message);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;