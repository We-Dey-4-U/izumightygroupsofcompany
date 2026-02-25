const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { User } = require("../models/user");
const rolePermissions = require("../utils/rolePermissions");


// =============================
// Assign Role by Email
// =============================
// =============================
// Assign Role by Email
// =============================
router.put("/assign-role", auth, async (req, res) => {
  try {
    if (!req.user.isSuperStakeholder && !req.user.isAdmin)
      return res.status(403).json({ message: "Not allowed" });

    const { email, role } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.companyId.equals(req.user.companyId))
      return res.status(403).json({ message: "Cannot manage user from another company" });

    // ✅ Reset all role flags
    user.isAdmin = false;
    user.isStaff = false;
    user.isSubAdmin = false;
    user.isFreelancer = false;
    user.isSuperStakeholder = false;

    // ✅ Assign selected role
    if (role === "ADMIN") user.isAdmin = true;
    if (role === "STAFF") user.isStaff = true;
    if (role === "SUB_ADMIN") user.isSubAdmin = true;
    if (role === "FREELANCER") user.isFreelancer = true;
    if (role === "SUPER_STAKEHOLDER") user.isSuperStakeholder = true;

    // ✅ Assign default permissions for the role
    user.permissions = rolePermissions[role] || []; // STAFF gets []

    await user.save();

    res.json({
      message: "Role assigned successfully",
      role,
      permissions: user.permissions
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});


// =============================
// Custom Permission Override
// =============================
router.put("/permissions", auth, async (req, res) => {
  try {
    if (!req.user.isSuperStakeholder)
      return res.status(403).json({ message: "Only super stakeholders allowed" });

    const { email, permissions } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: "User not found" });

    // ✅ Override permissions manually
    user.permissions = permissions;
    await user.save();

    res.json({ message: "Permissions updated", permissions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;