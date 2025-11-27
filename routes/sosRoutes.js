const express = require("express");
const router = express.Router();
const SOSAlert = require("../models/SOSAlert");
const { auth, isAdmin, isSubAdmin, isStaff, isSuperStakeholder } = require("../middleware/auth");

/* -----------------------------------
   1️⃣ RAISE SOS (Staff / Admin / SubAdmin)
-------------------------------------- */
router.post("/raise", auth, async (req, res) => {
  try {
    const alert = await SOSAlert.create({
      createdBy: req.user._id,
      companyId: req.user.companyId,
      category: req.body.category,
      type: req.body.type,
      message: req.body.message || "",
      location: req.body.location,
      notifyRoles: ["admin", "subadmin"],
    });

    res.status(201).json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------------------
   2️⃣ GET ALL SOS (Admin + SubAdmin ONLY)
-------------------------------------- */
router.get("/all", auth, async (req, res) => {
  try {
    if (!req.user.isAdmin && !req.user.isSubAdmin)
      return res.status(403).json({ error: "Access denied" });

    const alerts = await SOSAlert.find({ companyId: req.user.companyId })
      .populate("createdBy", "name email")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 });

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------------------
   3️⃣ GET MY SOS (Staff / Admin / SubAdmin)
-------------------------------------- */
router.get("/mine", auth, async (req, res) => {
  try {
    const alerts = await SOSAlert.find({
      createdBy: req.user._id,
      companyId: req.user.companyId,
    }).sort({ createdAt: -1 });

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------------------
   4️⃣ ASSIGN RESPONDER (Admin + SubAdmin)
-------------------------------------- */
router.patch("/assign/:id", auth, async (req, res) => {
  try {
    if (!req.user.isAdmin && !req.user.isSubAdmin)
      return res.status(403).json({ error: "Access denied" });

    const alert = await SOSAlert.findByIdAndUpdate(
      req.params.id,
      {
        assignedTo: req.body.userId,
        status: "Responding",
        updatedBy: req.user._id,
      },
      { new: true }
    );

    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------------------
   5️⃣ UPDATE STATUS (Responders)
-------------------------------------- */
router.patch("/status/:id", auth, async (req, res) => {
  try {
    const { status } = req.body;

    const updateObj = {
      status,
      updatedBy: req.user._id,
    };

    if (status === "Resolved") {
      updateObj.resolvedAt = new Date();
    }

    const alert = await SOSAlert.findByIdAndUpdate(
      req.params.id,
      updateObj,
      { new: true }
    );

    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------------------
   6️⃣ ADD INTERNAL NOTE (Admin / SubAdmin / Staff)
-------------------------------------- */
router.post("/note/:id", auth, async (req, res) => {
  try {
    const alert = await SOSAlert.findById(req.params.id);

    alert.notes.push({
      note: req.body.note,
      addedBy: req.user._id,
    });

    await alert.save();

    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------------------
   7️⃣ FILTER BY CATEGORY (Security / General / Office)
-------------------------------------- */
router.get("/filter/:category", auth, async (req, res) => {
  try {
    const alerts = await SOSAlert.find({
      companyId: req.user.companyId,
      category: req.params.category,
    }).sort({ createdAt: -1 });

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;