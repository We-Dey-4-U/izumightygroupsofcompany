require("dotenv").config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const { v4: uuidv4 } = require("uuid");
const Attendance = require("../models/Attendance");
const { isAdmin,isSubAdmin } = require("../middleware/auth");
const router = express.Router();

/* -------------------------------
   MULTER CONFIG (Memory Storage)
---------------------------------- */
const upload = multer({ storage: multer.memoryStorage() });

/* -------------------------------
   HELPER: Upload to Appwrite
---------------------------------- */
async function uploadToAppwrite(file) {
  if (!file || !file.buffer) throw new Error("No file buffer found");

  const fileId = uuidv4();
  const formData = new FormData();
  formData.append("fileId", fileId);
  formData.append("file", file.buffer, { filename: file.originalname, contentType: file.mimetype });

  console.log("📤 Uploading file to Appwrite:", file.originalname);

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

  const imageUrl = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${resp.data.$id}/view?project=${process.env.APPWRITE_PROJECT_ID}`;
  console.log("✅ File uploaded to Appwrite:", imageUrl);
  return { id: resp.data.$id, url: imageUrl };
}

/* -------------------------------
   CREATE NEW ATTENDANCE RECORD
---------------------------------- */
router.post("/", upload.single("image"), async (req, res) => {
  console.log("➡️ POST /attendance hit with body:", req.body);
  try {
    const { branch, department, name, email, mobileNumber, privateNote } = req.body;

    if (!req.file) {
      console.warn("⚠️ Image missing in attendance POST request");
      return res.status(400).json({ message: "Image is required! Please capture your photo." });
    }

    const uploaded = await uploadToAppwrite(req.file);

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const timeIn = now.toISOString();

    // Prevent duplicate attendance
    const existing = await Attendance.findOne({ email, date: today });
    if (existing) {
      console.warn("⚠️ Duplicate attendance attempt for:", email);
      return res.status(400).json({ message: "You have already submitted attendance for today." });
    }

    const todayCount = await Attendance.countDocuments({ date: today });
    const sn = todayCount + 1;

    const record = new Attendance({
      sn,
      branch,
      department,
      name,
      email,
      mobileNumber,
      privateNote,
      date: today,
      timeIn,
      timeOut: null,
      image: uploaded.url,
    });

    await record.save();
    console.log("✅ Attendance recorded:", record);
    res.status(201).json({ message: "Attendance recorded successfully!", data: record });
  } catch (error) {
    console.error("❌ [POST /attendance] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});


/* -------------------------------
   GET ALL ATTENDANCE RECORDS (ADMIN ONLY)
---------------------------------- */
router.get("/admin", isAdmin, isSubAdmin, async (req, res) => {
  console.log("➡️ GET /attendance/admin hit by admin");
  try {
    const records = await Attendance.find().sort({ createdAt: -1 });
    console.log(`✅ Found ${records.length} attendance records`);
    res.status(200).json(records);
  } catch (error) {
    console.error("❌ [GET /attendance/admin] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});


/* -------------------------------
   GET ALL ATTENDANCE RECORDS (PUBLIC)
---------------------------------- */
router.get("/all", async (req, res) => {
  console.log("➡️ GET /attendance/all hit (public)");
  try {
    const records = await Attendance.find().sort({ createdAt: -1 });
    console.log(`✅ Found ${records.length} public attendance records`);
    res.status(200).json(records);
  } catch (error) {
    console.error("❌ [GET /attendance/all] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

/* -------------------------------
   GET ALL ATTENDANCE RECORDS (ADMIN ONLY)
---------------------------------- */
router.get("/", isAdmin, isSubAdmin, async (req, res) => {
  console.log("➡️ GET /attendance hit by admin");
  try {
    const records = await Attendance.find().sort({ createdAt: -1 });
    console.log(`✅ Found ${records.length} attendance records`);
    res.status(200).json(records);
  } catch (error) {
    console.error("❌ [GET /attendance] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

/* -------------------------------
   GET ATTENDANCE FOR SINGLE STAFF
---------------------------------- */
router.get("/staff/:email", async (req, res) => {
  console.log("➡️ GET /attendance/staff/:email hit for:", req.params.email);
  try {
    const records = await Attendance.find({ email: req.params.email }).sort({ createdAt: -1 });
    console.log(`✅ Found ${records.length} records for ${req.params.email}`);
    res.status(200).json(records);
  } catch (error) {
    console.error("❌ [GET /attendance/staff/:email] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

/* -------------------------------
   UPDATE TIME OUT FOR STAFF
---------------------------------- */
router.put("/:id/timeout", async (req, res) => {
  console.log(`➡️ PUT /attendance/${req.params.id}/timeout hit with body:`, req.body);
  try {
    const { timeOut } = req.body;
    if (!timeOut) return res.status(400).json({ message: "Time Out value is required" });

    const record = await Attendance.findById(req.params.id);
    if (!record) {
      console.warn("⚠️ Attendance record not found:", req.params.id);
      return res.status(404).json({ message: "Attendance record not found" });
    }

    const now = new Date();
    if (now.getHours() < 17) {
      console.warn("⚠️ Attempt to update Time Out before 5 PM");
      return res.status(403).json({ message: "Time Out can only be updated after 5 PM" });
    }

    record.timeOut = timeOut;
    await record.save();
    console.log("✅ Time Out updated:", record);
    res.status(200).json(record);
  } catch (error) {
    console.error("❌ [PUT /attendance/:id/timeout] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});



/* -------------------------------
   5️⃣ ALL-TIME OVERVIEW (Totals)
---------------------------------- */
router.get("/alltime-summary", isAdmin, isSubAdmin, async (req, res) => {
  try {
    // ✅ Get totals from MongoDB
    const [totalUsers, totalProducts, totalOrders, totalEarnings] =
      await Promise.all([
        User.countDocuments({}), // all users
        require("../models/product").Product.countDocuments({}), // all products
        require("../models/order").Order.countDocuments({}), // all orders
        require("../models/order").Order.aggregate([
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
      ]);

    res.status(200).json({
      users: totalUsers || 0,
      products: totalProducts || 0,
      orders: totalOrders || 0,
      earnings: totalEarnings[0]?.total || 0,
    });
  } catch (error) {
    console.error("❌ All-time summary error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

/* -------------------------------
   DELETE ATTENDANCE RECORD (ADMIN)
---------------------------------- */
router.delete("/:id", isAdmin, async (req, res) => {
  console.log(`➡️ DELETE /attendance/${req.params.id} hit by admin`);
  try {
    const record = await Attendance.findById(req.params.id);
    if (!record) {
      console.warn("⚠️ Attendance record not found for deletion:", req.params.id);
      return res.status(404).json({ message: "Attendance record not found" });
    }

    // Delete Appwrite image
    if (record.image?.id) {
      try {
        await axios.delete(
          `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${record.image.id}`,
          {
            headers: {
              "X-Appwrite-Project": process.env.APPWRITE_PROJECT_ID,
              "X-Appwrite-Key": process.env.APPWRITE_API_KEY,
            },
          }
        );
        console.log("✅ Appwrite image deleted:", record.image.id);
      } catch (err) {
        console.warn("⚠️ Failed to delete Appwrite image:", err.message);
      }
    }

    await Attendance.findByIdAndDelete(req.params.id);
    console.log("✅ Attendance record deleted:", req.params.id);
    res.status(200).json({ message: "Record deleted successfully" });
  } catch (error) {
    console.error("❌ [DELETE /attendance/:id] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;