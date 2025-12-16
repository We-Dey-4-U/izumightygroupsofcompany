const express = require("express");
const router = express.Router();
const { Report } = require("../models/Report");
const { User } = require("../models/user");
const { auth, isAdmin, isStaff, isSubAdmin, isSuperStakeholder } = require("../middleware/auth");

// ---- GET ALL REPORTS (Company-Isolated for Admin/SubAdmin/SuperStakeholder) ----
router.get("/", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSubAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    // Find all users in the same company
    const usersInCompany = await User.find({
      $or: [
        { companyId: req.companyId },
        { company: req.user.company }
      ]
    }).select("_id");

    const userIds = usersInCompany.map(u => u._id);

    // Fetch reports entered by users in the same company
    const reports = await Report.find({ submittedBy: { $in: userIds } })
      .populate("submittedBy", "name email company companyId")
      .sort({ dateSubmitted: -1 });

    res.status(200).json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ----- GET MY REPORTS (STAFF ONLY) -----
// ----- GET MY REPORTS (STAFF ONLY) -----
router.get("/my", auth, isStaff, async (req, res) => {
  try {
    const reports = await Report.find({ submittedBy: req.user._id }).sort({ dateSubmitted: -1 });
    res.status(200).json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ----- GET SINGLE REPORT (Same company check) -----
// ----- GET SINGLE REPORT (Company-Isolated) -----
router.get("/:id", auth, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("submittedBy", "name email company companyId");
    if (!report) return res.status(404).json({ message: "Report not found" });

    // Only allow access if report belongs to the same company
    if (!(
      report.submittedBy.companyId?.equals(req.companyId) ||
      report.submittedBy.company === req.user.company
    )) return res.status(403).json({ message: "Access denied: Different company" });

    // Staff can only access their own reports
    if (req.user.isStaff && report.submittedBy._id.toString() !== req.user._id) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ----- CREATE REPORT (STAFF ONLY — Tied to company) -----
// ----- CREATE REPORT (STAFF ONLY) -----
router.post("/", auth, isStaff, async (req, res) => {
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
      rolePlayed,
      selfRating
    } = req.body;

    if (!department || !designation || !weekEnding || !summary) {
      return res.status(400).json({ message: "Department, Designation, Week Ending, and Summary are required" });
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
      rolePlayed: rolePlayed || "",
      selfRating: selfRating || 5,
      submittedBy: req.user._id,
    });

    const saved = await report.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ----- UPDATE REPORT (Company Restricted) -----
// ----- UPDATE REPORT (Company-Isolated) -----
router.put("/:id", auth, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("submittedBy", "company companyId");
    if (!report) return res.status(404).json({ message: "Report not found" });

    // Restrict updates to same company
    if (!(
      report.submittedBy.companyId?.equals(req.companyId) ||
      report.submittedBy.company === req.user.company
    )) return res.status(403).json({ message: "Access denied (different company)" });

    // Staff can only update their own report
    if (req.user.isStaff && report.submittedBy._id.toString() !== req.user._id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const editableFields = [
      "department", "designation", "weekEnding", "summary", "tasksCompleted",
      "tasksInProgress", "challenges", "nextWeekTargets", "supportNeeded",
      "fileUploads", "rolePlayed", "selfRating"
    ];

    editableFields.forEach(field => {
      if (req.body[field] !== undefined) report[field] = req.body[field];
    });

    // Admin/SubAdmin/SuperStakeholder can update supervisorComment or performanceRating
    if (req.user.isAdmin || req.user.isSubAdmin || req.user.isSuperStakeholder) {
      if (req.body.supervisorComment !== undefined) report.supervisorComment = req.body.supervisorComment;
      if (req.body.performanceRating !== undefined) report.performanceRating = req.body.performanceRating;
    }

    const updated = await report.save();
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ----- DELETE REPORT (ADMIN ONLY + Same company) -----
// ----- DELETE REPORT (Admin Only, Company-Isolated) -----
router.delete("/:id", auth, isAdmin, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("submittedBy", "company companyId");
    if (!report) return res.status(404).json({ message: "Report not found" });

    // Only same company
    if (!(
      report.submittedBy.companyId?.equals(req.companyId) ||
      report.submittedBy.company === req.user.company
    )) return res.status(403).json({ message: "Cannot delete report from another company" });

    await Report.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Report deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;