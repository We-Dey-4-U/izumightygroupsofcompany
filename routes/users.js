const { User } = require("../models/user");
const moment = require("moment");
const { auth, isAdmin } = require("../middleware/auth");

const router = require("express").Router();

// ===============================
// GET USER STATS (ADMIN ONLY)
// Company-isolated + audit safe
// ===============================
router.get("/stats", isAdmin, async (req, res) => {
  const previousMonth = moment()
    .month(moment().month() - 1)
    .set("date", 1)
    .format("YYYY-MM-DD HH:mm:ss");

  try {
    // 🔐 COMPANY ISOLATION FIX
    const matchStage = req.user.isSuperAdmin
      ? { createdAt: { $gte: new Date(previousMonth) } }
      : {
          companyId: req.user.companyId,
          createdAt: { $gte: new Date(previousMonth) },
        };

    const users = await User.aggregate([
      { $match: matchStage },
      {
        $project: {
          month: { $month: "$createdAt" },
        },
      },
      {
        $group: {
          _id: "$month",
          total: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json(users);
  } catch (err) {
    console.error("❌ USER STATS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ========================================
// GET USERS FROM SAME COMPANY (SAFE)
// ========================================
router.get("/company", auth, async (req, res) => {
  try {
    if (!req.user.companyId) {
      return res
        .status(400)
        .json({ message: "User is not linked to a company" });
    }

    const users = await User.find({
      companyId: req.user.companyId,
      $or: [{ isFreelancer: true }, { isStaff: true }],
    }).select("_id name email isFreelancer isStaff");

    res.status(200).json(users);
  } catch (err) {
    console.error("🔥 [GET COMPANY USERS ERROR]:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;