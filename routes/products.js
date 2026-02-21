require("dotenv").config();
const { Product } = require("../models/product");
const mongoose = require("mongoose"); // ✅ ADD THIS
const { isAdmin, auth } = require("../middleware/auth");
const router = require("express").Router();
const multer = require("multer");
const axios = require("axios");
const Joi = require("joi");
const FormData = require("form-data");
const { v4: uuidv4 } = require("uuid");



// ✅ Import sanitize middleware
const sanitizeBody = require("../middleware/sanitize");

// ---- Multer Config (Memory Storage) ----
const upload = multer({ storage: multer.memoryStorage() });

// ---- 🧠 Appwrite Connectivity Check --
(async () => {
  console.log("🧠 Checking Appwrite configuration...");
  const { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_BUCKET_ID, APPWRITE_API_KEY } = process.env;

  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_BUCKET_ID || !APPWRITE_API_KEY) {
    console.error("❌ Missing Appwrite environment variables!");
    return;
  }

  try {
    const res = await axios.get(
      `${APPWRITE_ENDPOINT}/storage/buckets/${APPWRITE_BUCKET_ID}`,
      {
        headers: {
          "X-Appwrite-Project": APPWRITE_PROJECT_ID,
          "X-Appwrite-Key": APPWRITE_API_KEY,
        },
      }
    );
    console.log("✅ Appwrite bucket check success:", res.data.name || APPWRITE_BUCKET_ID);
  } catch (err) {
    console.error("❌ Appwrite bucket check failed:", err.response?.data || err.message);
  }
})();



// ---------- Helpers ----------
const objectIdSchema = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
  }
  return value;
}, "ObjectId Validation");

// ---- Helper: Upload to Appwrite via REST API using server-side API Key ----
async function uploadToAppwrite(file) {
  console.log("🟦 [uploadToAppwrite] Starting upload for:", file.originalname);

  if (!file || !file.buffer) {
    console.error("❌ [uploadToAppwrite] Missing file buffer");
    throw new Error("No file buffer found");
  }

  const fileId = uuidv4();
  console.log("🟩 [uploadToAppwrite] Generated fileId:", fileId);

  const formData = new FormData();
  formData.append("fileId", fileId);
  formData.append("file", file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
    knownLength: file.size,
  });

  try {
    console.log("📤 [uploadToAppwrite] Uploading to Appwrite...");
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

    console.log("✅ [uploadToAppwrite] Upload success:", resp.data.$id);

    const imageUrl = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${resp.data.$id}/view?project=${process.env.APPWRITE_PROJECT_ID}`;

    return { id: resp.data.$id, url: imageUrl };
  } catch (err) {
    console.error("❌ [uploadToAppwrite] Upload failed:", err.response?.data || err.message);
    throw new Error("Appwrite upload failed");
  }
}



// ===============================
// CREATE PRODUCT
// ===============================
router.post(
  "/",
    auth,
  isAdmin,
  upload.array("images"),
  // ✅ Only sanitize free-text inputs (name, desc, features)
  sanitizeBody(["name", "desc", "features"]),
  async (req, res) => {
     // 🧪 TEMP DEBUG — ADD HERE
    console.log("UPLOAD USER:", req.user?._id);
    console.log("UPLOAD COMPANY:", req.user?.companyId);
    try {
      const schema = Joi.object({
        name: Joi.string().min(1).max(200).required(),
        // ✅ Enum validation for category
        category: Joi.string()
          .valid(
            "CCTV & Security",
            "Networking Devices",
            "Computers & Laptops",
            "Servers & Storage",
            "Software Solutions",
            "Custom Software Development",
            "Cybersecurity Tools",
            "Digital Transformation Tools",
            "Telecom Equipment",
            "IT Infrastructure Solutions",
            "Cloud & Hosting Services",
            "IT Sales and Deployment",
            "Inventory Solutions",
            "Access Control Solutions",
            "Tracking Solutions",
            "Smart Home Automation",
            "Power & Backup Solutions",
            "Printers & Scanners",
            "Men",
            "Women",
            "Kids",
            "Unisex",
            "Men Clothing",
            "Men Shoes",
            "Men Accessories",
            "Women Clothing",
            "Women Shoes",
            "Women Accessories",
            "Kids Clothing",
            "Kids Shoes",
            "Kids Accessories",
            "Bags",
            "Watches",
            "Jewelry",
            "Sportswear",
            "Traditional Wear",
            "Aso Ebi",
            "Swiss Fabrics",
            "Aso Oke",
            "Ankara Fabrics",
            "Lace Fabrics",
            "George Fabrics",
            "Voile Lace",
            "Dry Lace",
            "Guipure Lace",
            "3D Head Gear",
            "Gele",
            "Caps & Headwear",
            "Traditional Headwear",
            "Wedding Fabrics",
            "Party & Celebration Fabrics",
            "Bridal Fabrics",
            "Ceremonial Wear",
            "Cereals & Grains",
            "Legumes & Pulses",
            "Roots & Tubers",
            "Vegetables",
            "Fruits",
            "Cash Crops",
            "Herbs & Spices",
            "Poultry",
            "Cattle",
            "Goats & Sheep",
            "Pigs",
            "Rabbits",
            "Livestock Feeds",
            "Eggs",
            "Milk & Dairy Products",
            "Meat Products",
            "Leather & Hides",
            "Fish",
            "Shrimp & Prawns",
            "Crabs & Shellfish",
            "Fish Feed",
            "Aquaculture Equipment",
            "Seeds & Seedlings",
            "Fertilizers",
            "Pesticides & Herbicides",
            "Organic Farm Inputs",
            "Animal Vaccines",
            "Farm Tools",
            "Farm Machinery",
            "Irrigation Equipment",
            "Greenhouse Equipment",
            "Storage & Silos",
            "Processed Foods",
            "Packaged Grains",
            "Flour & Starches",
            "Oils & Extracts",
            "All Products"
          )
          .required(),
        desc: Joi.string().min(1).max(3000).required(),
        price: Joi.number().min(0).required(),
        originalPrice: Joi.number().min(0).optional(),
        discountPercent: Joi.number().min(0).max(100).optional(),
        rating: Joi.number().min(1).max(5).optional(),
        features: Joi.any(),
      });

      const { error, value } = schema.validate(req.body, { stripUnknown: false });
      if (error) return res.status(400).json({ message: error.details[0].message });

      if (!req.files?.length)
        return res.status(400).json({ message: "No images uploaded" });

      // ---- Features normalization ----
      let parsedFeatures = [];
      if (value.features) {
        if (Array.isArray(value.features)) {
          parsedFeatures = value.features.map(String).map(f => f.trim()).filter(Boolean);
        } else {
          try {
            const maybe = JSON.parse(value.features);
            parsedFeatures = Array.isArray(maybe)
              ? maybe.map(String).map(f => f.trim()).filter(Boolean)
              : String(value.features).split(",").map(f => f.trim()).filter(Boolean);
          } catch {
            parsedFeatures = String(value.features).split(",").map(f => f.trim()).filter(Boolean);
          }
        }
      }

      const images = await Promise.all(req.files.map(uploadToAppwrite));

      const companyId = req.user.companyId;

if (!companyId) {
  return res.status(400).json({ message: "Company not resolved for user" });
}

const product = new Product({
  companyId,
  createdBy: req.user._id,
  name: value.name,
  category: value.category,
  desc: value.desc,
  price: Number(value.price),
  originalPrice: Number(value.originalPrice || 0),
  rating: Number(value.rating || 0),
  discountPercent: Number(value.discountPercent || 0),
  features: parsedFeatures,
  images,
});

      const saved = await product.save();
      res.status(201).json(saved);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);




//Add a simple route to let users add/remove product to wishlist:

// ===============================
// WISHLIST TOGGLE
// ===============================
router.post("/:id/wishlist", async (req, res) => {
  const idCheck = objectIdSchema.validate(req.params.id);
  if (idCheck.error) return res.status(400).json({ message: "Invalid product ID" });

  const schema = Joi.object({
    userId: objectIdSchema.required(),
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const index = product.wishlistedBy.indexOf(value.userId);
    index > -1 ? product.wishlistedBy.splice(index, 1) : product.wishlistedBy.push(value.userId);

    await product.save();
    res.status(200).json({ wishlistedBy: product.wishlistedBy });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});




// ---- UPDATE PRODUCT ----
// ===============================
// UPDATE PRODUCT
// ---- UPDATE PRODUCT ----
router.put(
  "/:id",
   auth,
  isAdmin,
  upload.array("images"),
  sanitizeBody(["name", "category", "desc", "features"]),
  async (req, res) => {
    const idCheck = objectIdSchema.validate(req.params.id);
    if (idCheck.error) return res.status(400).json({ message: "Invalid product ID" });

    try {
      const product = await Product.findOne({ _id: req.params.id, companyId: req.user.companyId });
      if (!product) return res.status(403).json({ message: "Not authorized" });

      const schema = Joi.object({
        name: Joi.string().min(1).max(200),
        category: Joi.string(),
        desc: Joi.string().min(1).max(3000),
        price: Joi.number().min(0),
        originalPrice: Joi.number().min(0),
         vatPercent: Joi.number().min(0).max(100), // ✅ ADD
        discountPercent: Joi.number().min(0).max(100),
        rating: Joi.number().min(1).max(5),
        features: Joi.any(),
      });

      const { error, value } = schema.validate(req.body, { stripUnknown: false });
      if (error) return res.status(400).json({ message: error.details[0].message });

      if (req.files?.length) product.images = await Promise.all(req.files.map(uploadToAppwrite));
      Object.assign(product, value);
      const updated = await product.save();
      res.status(200).json(updated);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ---- DELETE PRODUCT ----
// ---- DELETE PRODUCT ----
router.delete("/:id", auth, isAdmin, async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!product) return res.status(403).json({ message: "Not authorized to delete this product" });

    if (Array.isArray(product.images)) {
      for (const image of product.images) {
        if (image.id) {
          try {
            await axios.delete(`${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${image.id}`, {
              headers: {
                "X-Appwrite-Project": process.env.APPWRITE_PROJECT_ID,
                "X-Appwrite-Key": process.env.APPWRITE_API_KEY,
              },
            });
          } catch {}
        }
      }
    }

    const deletedProduct = await Product.findByIdAndDelete(product._id);
    res.status(200).json(deletedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---- GET ALL PRODUCTS ----
// ---- GET ALL PRODUCTS (PUBLIC) ----
// ---- GET ALL PRODUCTS ----
router.get("/", async (req, res) => {
  console.log("📥 [GET /products] Fetch all products request");
  try {
    // Nested population: get uploader's company name
    const products = await Product.find().populate({
      path: "createdBy",
      select: "companyId",
      populate: { path: "companyId", select: "name" } // populate company name
    });

    // Transform response to include uploaderCompanyName
    const response = products.map(product => ({
      ...product.toObject(),
      uploaderCompanyName: product.createdBy?.companyId?.name || "Unknown"
    }));

    console.log(`✅ [GET /products] Found ${products.length} products`);

    // Log how many have discount
    const discountedCount = products.filter(p => Number(p.discountPercent) > 0).length;
    console.log(`💰 Discounted products count: ${discountedCount}`);

    res.status(200).json(response);
  } catch (error) {
    console.error("❌ [GET /products] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});





router.get("/superadmin/all", auth, async (req, res) => {
  if (!req.user.isSuperAdmin)
    return res.status(403).json({ message: "Access denied" });

  const products = await Product.find().populate({
    path: "createdBy",
    select: "companyId",
    populate: { path: "companyId", select: "name" }
  });

  res.json(products);
});



// Admin product list (table with delete/update buttons)
// ---- GET ALL PRODUCTS FOR ADMIN (COMPANY ISOLATED) ----
// ===============================
// GET ALL PRODUCTS FOR ADMIN (COMPANY ISOLATED)
// ===============================
router.get("/admin", auth, isAdmin, async (req, res) => {
  try {
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.status(400).json({
        message: "Company not resolved for user",
      });
    }

    const products = await Product.find({ companyId }).populate({
      path: "createdBy",
      select: "companyId",
      populate: {
        path: "companyId",
        select: "name",
      },
    });

    const result = products.map((p) => ({
      ...p.toObject(),
      companyId: String(p.companyId),
      uploaderCompanyName: p.createdBy?.companyId?.name || "Unknown",
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error("Admin products fetch error:", error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});


// ---- GET PRODUCTS BY CATEGORY ----
// ---- GET PRODUCTS BY CATEGORY ----
router.get("/category/:category", async (req, res) => {
  try {
    const products = await Product.find({ category: req.params.category }).populate({
      path: "createdBy",
      select: "companyId",
      populate: { path: "companyId", select: "name" }
    });

    const response = products.map(p => ({
      ...p.toObject(),
      companyId: String(p.companyId),
      uploaderCompanyName: p.createdBy?.companyId?.name || "Unknown"
    }));

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ---- GET SINGLE PRODUCT ----
// ---- GET SINGLE PRODUCT ----
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate({
      path: "createdBy",
      select: "companyId",
      populate: { path: "companyId", select: "name" }
    });

    if (!product) return res.status(404).json({ message: "Product not found" });

    const response = {
      ...product.toObject(),
      companyId: String(product.companyId),
      uploaderCompanyName: product.createdBy?.companyId?.name || "Unknown"
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});




router.get("/og/product/:id", async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).send("Product not found");

  // Default placeholder image
  let imageUrl = `${process.env.CLIENT_URL}/placeholder.png`;

  if (product.images?.length) {
    const img = product.images[0];

    // If Appwrite file ID exists, generate full URL
    if (img.id) {
      imageUrl = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${img.id}/view?project=${process.env.APPWRITE_PROJECT_ID}`;
    } 
    // Otherwise, use URL or make absolute
    else if (img.url) {
      if (img.url.startsWith("http")) {
        imageUrl = img.url;
      } else {
        imageUrl = `${process.env.CLIENT_URL}${img.url}`;
      }
    }
  }

  // Escape HTML to prevent injection
  const escapeHTML = (str) =>
    String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  // Server-rendered OG HTML for social media crawlers
  res.set("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHTML(product.name)} | CrushStore</title>
  <meta property="og:title" content="${escapeHTML(product.name)}" />
  <meta property="og:description" content="${escapeHTML(product.desc)}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${process.env.CLIENT_URL}/product/${product._id}" />
  <meta property="og:type" content="product" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHTML(product.name)}" />
  <meta name="twitter:description" content="${escapeHTML(product.desc)}" />
  <meta name="twitter:image" content="${imageUrl}" />
</head>
<body>
  <h1>${escapeHTML(product.name)}</h1>
  <img src="${imageUrl}" alt="${escapeHTML(product.name)}" />
</body>
</html>`);
});

module.exports = router;

















// const { Product } = require("../models/product");
// const { isAdmin } = require("../middleware/auth");
// const router = require("express").Router();
// const multer = require("multer");
// const path = require("path");
// const fs = require("fs");

// // --- Ensure uploads folder exists ---
// const uploadDir = "uploads";
// if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// // --- Multer config ---
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, uploadDir),
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     cb(null, uniqueSuffix + path.extname(file.originalname));
//   },
// });

// const fileFilter = (req, file, cb) => {
//   const allowedTypes = /jpeg|jpg|png|gif/;
//   const valid =
//     allowedTypes.test(path.extname(file.originalname).toLowerCase()) &&
//     allowedTypes.test(file.mimetype);
//   cb(valid ? null : new Error("Only images are allowed"), valid);
// };

// const upload = multer({ storage, fileFilter });

// // --- CREATE PRODUCT ---
// router.post("/", isAdmin, upload.single("image"), async (req, res) => {
//   try {
//     const { name, category, desc, price, originalPrice, rating } = req.body;
//     const image = req.file ? req.file.path : null;

//     console.log("Creating product:", { name, category, desc, price, originalPrice, rating, image });

//     const product = new Product({
//       name,
//       category,           // ✅ use category enum
//       desc,
//       price: Number(price),
//       originalPrice: originalPrice ? Number(originalPrice) : undefined,
//       rating: rating ? Number(rating) : undefined,
//       image,
//     });

//     const savedProduct = await product.save();
//     console.log("Product saved:", savedProduct);
//     res.status(200).send(savedProduct);
//   } catch (error) {
//     console.error("Create product error:", error);
//     res.status(500).send(error);
//   }
// });

// // --- UPDATE PRODUCT ---
// router.put("/:id", isAdmin, upload.single("image"), async (req, res) => {
//   try {
//     const updateData = { ...req.body };

//     if (req.file) {
//       const product = await Product.findById(req.params.id);
//       if (product.image) fs.unlink(product.image, (err) => err && console.error(err));
//       updateData.image = req.file.path;
//     }

//     if (updateData.price) updateData.price = Number(updateData.price);
//     if (updateData.originalPrice) updateData.originalPrice = Number(updateData.originalPrice);
//     if (updateData.rating) updateData.rating = Number(updateData.rating);

//     const updatedProduct = await Product.findByIdAndUpdate(
//       req.params.id,
//       updateData,
//       { new: true }
//     );

//     console.log("Product updated:", updatedProduct);
//     res.status(200).send(updatedProduct);
//   } catch (error) {
//     console.error("Update error:", error);
//     res.status(500).send(error);
//   }
// });

// // --- DELETE PRODUCT ---
// router.delete("/:id", isAdmin, async (req, res) => {
//   try {
//     const product = await Product.findById(req.params.id);
//     if (!product) return res.status(404).send("Product not found...");
//     if (product.image) fs.unlink(product.image, (err) => err && console.error(err));
//     const deletedProduct = await Product.findByIdAndDelete(req.params.id);
//     console.log("Product deleted:", deletedProduct);
//     res.status(200).send(deletedProduct);
//   } catch (error) {
//     console.error("Delete error:", error);
//     res.status(500).send(error);
//   }
// });

// // --- GET ALL PRODUCTS ---
// router.get("/", async (req, res) => {
//   try {
//     const products = await Product.find();
//     console.log("Fetched products:", products);
//     res.status(200).send(products);
//   } catch (error) {
//     console.error("Fetch products error:", error);
//     res.status(500).send(error);
//   }
// });

// // --- GET SINGLE PRODUCT ---
// router.get("/:id", async (req, res) => {
//   try {
//     const product = await Product.findById(req.params.id);
//     if (!product) return res.status(404).send("Product not found");
//     res.status(200).send(product);
//   } catch (error) {
//     console.error("Fetch single product error:", error);
//     res.status(500).send(error);
//   }
// });

// // --- GET PRODUCTS BY CATEGORY ---
// router.get("/category/:category", async (req, res) => {
//   try {
//     const products = await Product.find({ category: req.params.category });
//     console.log(`Fetched products for category ${req.params.category}:`, products);
//     res.status(200).json(products);
//   } catch (err) {
//     console.error("Fetch products by category error:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// module.exports = router;