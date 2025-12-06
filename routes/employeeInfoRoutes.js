require("dotenv").config();
const express = require("express");
const router = express.Router();
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const { v4: uuidv4 } = require("uuid");
const { auth, isStaff, isAdmin, isSubAdmin, isSuperStakeholder } = require("../middleware/auth");
const EmployeeInfo = require("../models/EmployeeInfo");

// ----------------------
// MULTER (Memory Storage)
// ----------------------
const upload = multer({ storage: multer.memoryStorage() });

// ----------------------
// HELPER: Upload to Appwrite
// ----------------------
async function uploadToAppwrite(file) {
  if (!file || !file.buffer) throw new Error("No file buffer found");

  const fileId = uuidv4();
  const formData = new FormData();
  formData.append("fileId", fileId);
  formData.append("file", file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
  });

  try {
    const resp = await axios.post(
      `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files`,
      formData,
      {
        headers: {
          "X-Appwrite-Project": process.env.APPWRITE_PROJECT_ID,
          "X-Appwrite-Key": process.env.APPWRITE_API_KEY,
          ...formData.getHeaders(),
        },
        maxBodyLength: Infinity,
      }
    );

    return `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${resp.data.$id}/view?project=${process.env.APPWRITE_PROJECT_ID}`;
  } catch (uploadErr) {
    console.error("Upload to Appwrite failed:", uploadErr.message);
    throw uploadErr;
  }
}

// ----------------------
// POST: Submit Employee Info
// ----------------------
router.post(
  "/submit",
  auth,
  isStaff,
  upload.fields([
    { name: "employeePassport", maxCount: 1 },
    { name: "meansOfIdImage", maxCount: 1 },
    { name: "guarantorPassport", maxCount: 1 },
    { name: "guarantorMeansOfId", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const userId = req.user._id;

      // Check if user already submitted
      const existing = await EmployeeInfo.findOne({ user: userId });
      if (existing) {
        return res.status(400).json({ message: "You have already submitted your employee info. You cannot submit again." });
      }

      const data = req.body;

      // Parse once
      const personal = JSON.parse(data.personal);
      const contact = JSON.parse(data.contact);
      const nextOfKin = JSON.parse(data.nextOfKin);
      const employment = JSON.parse(data.employment);
      const education = JSON.parse(data.education);
      const bank = JSON.parse(data.bank);
      const identification = JSON.parse(data.identification);
      const guarantorData = JSON.parse(data.guarantor);

      // Upload images
      const employeePassport = req.files.employeePassport?.[0]
        ? await uploadToAppwrite(req.files.employeePassport[0])
        : null;

      const employeeMeansOfId = req.files.meansOfIdImage?.[0]
        ? await uploadToAppwrite(req.files.meansOfIdImage[0])
        : null;

      const guarantorPassport = req.files.guarantorPassport?.[0]
        ? await uploadToAppwrite(req.files.guarantorPassport[0])
        : null;

      const guarantorMeansOfId = req.files.guarantorMeansOfId?.[0]
        ? await uploadToAppwrite(req.files.guarantorMeansOfId[0])
        : null;

      // Build payload
      const payload = {
        user: userId,
        personal,
        contact,
        nextOfKin,
        employment,
        education,
        identification: { ...identification, meansOfIdImage: employeeMeansOfId },
        bank,
        guarantor: {
          fullName: guarantorData.fullName,
          relationship: guarantorData.relationship,
          identification: {
            idType: guarantorData.identification.idType,
            idNumber: guarantorData.identification.idNumber,
            expiryDate: guarantorData.identification.expiryDate,
            meansOfIdImage: guarantorMeansOfId,
          },
          passport: guarantorPassport,
          address: guarantorData.address,
          phoneNumber: guarantorData.phoneNumber,
        },
        employeePassport,
      };

      const saved = await EmployeeInfo.create(payload);

      res.status(200).json({ message: "Employee info submitted", saved });
    } catch (err) {
      res.status(500).json({ message: err.message, stack: err.stack });
    }
  }
);

// ----------------------
// GET all employee info (admin/subadmin/stakeholder) with company isolation
// ----------------------
router.get("/all", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSubAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    // Fetch all employees, populate user to get company
    let allEmployees = await EmployeeInfo.find().populate("user", "name email company role");

    // 🔥 Filter employees strictly by logged-in user's company
    allEmployees = allEmployees.filter(emp => emp.user?.company === req.user.company);

    res.status(200).json(allEmployees);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ----------------------
// GET logged-in staff's info
// ----------------------
router.get("/me", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isStaff && !req.user.isSubAdmin) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const info = await EmployeeInfo.findOne({ user: req.user._id });

    if (!info) {
      return res.status(404).json({ message: "No employee info found" });
    }

    res.status(200).json(info);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ----------------------
// MONTHLY EMPLOYEE SUMMARY (optional)
// ----------------------
router.get("/summary/monthly", auth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSubAdmin && !req.user.isSuperStakeholder) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    let employees = await EmployeeInfo.find({
      createdAt: { $gte: startOfMonth, $lt: endOfMonth }
    }).populate("user", "company");

    // Filter by user's company
    employees = employees.filter(emp => emp.user?.company === req.user.company);

    const summary = {
      totalSubmitted: employees.length,
      employees: employees.map(emp => ({
        name: emp.personal.fullName,
        department: emp.employment.department,
        position: emp.employment.position,
      }))
    };

    res.status(200).json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;