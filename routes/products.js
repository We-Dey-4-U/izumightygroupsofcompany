require("dotenv").config();
const { Product } = require("../models/product");
const { isAdmin } = require("../middleware/auth");
const router = require("express").Router();
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const { v4: uuidv4 } = require("uuid");


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

// ---- Multer Config (Memory Storage) ----
const upload = multer({ storage: multer.memoryStorage() });

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

// ---- CREATE PRODUCT ----
// ---- CREATE PRODUCT ----
// routes/products.js (create route)
router.post("/", isAdmin, upload.array("images"), async (req, res) => {
  try {
    console.log("📦 [CREATE PRODUCT] Raw req.body:", req.body);
    console.log("📦 [CREATE PRODUCT] Number of files:", (req.files || []).length);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No images uploaded" });
    }

    // Features normalization
    let parsedFeatures = [];
    if (req.body.features) {
      if (Array.isArray(req.body.features)) {
        parsedFeatures = req.body.features.map(String).map(f => f.trim()).filter(Boolean);
      } else {
        try {
          const maybe = JSON.parse(req.body.features);
          if (Array.isArray(maybe)) parsedFeatures = maybe.map(String).map(f => f.trim()).filter(Boolean);
          else parsedFeatures = String(req.body.features).split(",").map(f => f.trim()).filter(Boolean);
        } catch {
          parsedFeatures = String(req.body.features).split(",").map(f => f.trim()).filter(Boolean);
        }
      }
    }

    // Numeric parsing
    const parsedPrice = req.body.price !== undefined && req.body.price !== "" ? Number(req.body.price) : 0;
    const parsedOriginal = req.body.originalPrice !== undefined && req.body.originalPrice !== "" ? Number(req.body.originalPrice) : 0;
    const parsedRating = req.body.rating !== undefined && req.body.rating !== "" ? Number(req.body.rating) : 0;
    const parsedDiscount = req.body.discountPercent !== undefined && req.body.discountPercent !== "" ? Number(req.body.discountPercent) : 0;

    // Upload images to Appwrite
    const images = await Promise.all(req.files.map(file => uploadToAppwrite(file)));

    // Save product with company isolation
    const product = new Product({
      companyId: req.user.companyId,
      createdBy: req.user._id, // 🔥 Track uploader
      name: req.body.name,
      category: req.body.category,
      desc: req.body.desc,
      price: parsedPrice,
      originalPrice: parsedOriginal,
      rating: parsedRating,
      discountPercent: parsedDiscount,
      features: parsedFeatures,
      images,
    });

    const savedProduct = await product.save();
    console.log("✅ Product saved:", savedProduct._id);

    res.status(200).json(savedProduct);
  } catch (error) {
    console.error("❌ [CREATE PRODUCT] Error:", error);
    res.status(500).json({ message: error.message || String(error) });
  }
});




//Add a simple route to let users add/remove product to wishlist:
// Add or remove from wishlist
router.post("/:id/wishlist", async (req, res) => {
  const userId = req.body.userId; // send userId from frontend
  if (!userId) return res.status(400).json({ message: "User ID required" });

  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const index = product.wishlistedBy.indexOf(userId);
    if (index > -1) {
      // already in wishlist -> remove
      product.wishlistedBy.splice(index, 1);
    } else {
      // add to wishlist
      product.wishlistedBy.push(userId);
    }

    await product.save();
    res.status(200).json({ wishlistedBy: product.wishlistedBy });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---- UPDATE PRODUCT ----
router.put("/:id", isAdmin, upload.array("images"), async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Fetch only products belonging to admin's company
    const product = await Product.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!product) return res.status(403).json({ message: "Not authorized to update this product" });

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      const images = await Promise.all(req.files.map((file) => uploadToAppwrite(file)));
      updateData.images = images;
    }

    // Features normalization
    if (updateData.features !== undefined && updateData.features !== null && updateData.features !== "") {
      if (!Array.isArray(updateData.features)) {
        try {
          const maybe = JSON.parse(updateData.features);
          if (Array.isArray(maybe)) updateData.features = maybe.map(String).map(f => f.trim()).filter(Boolean);
          else updateData.features = String(updateData.features).split(",").map(f => f.trim()).filter(Boolean);
        } catch {
          updateData.features = String(updateData.features).split(",").map(f => f.trim()).filter(Boolean);
        }
      } else updateData.features = updateData.features.map(String).map(f => f.trim()).filter(Boolean);
    }

    // Numeric conversions
    if (updateData.price !== undefined && updateData.price !== "") updateData.price = Number(updateData.price);
    if (updateData.originalPrice !== undefined && updateData.originalPrice !== "") updateData.originalPrice = Number(updateData.originalPrice);
    if (updateData.rating !== undefined && updateData.rating !== "") updateData.rating = Number(updateData.rating);
    if (updateData.discountPercent !== undefined && updateData.discountPercent !== "") updateData.discountPercent = Number(updateData.discountPercent);

    Object.assign(product, updateData);
    const updatedProduct = await product.save();

    res.status(200).json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message || String(error) });
  }
});



// ---- DELETE PRODUCT ----
router.delete("/:id", isAdmin, async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!product) return res.status(403).json({ message: "Not authorized to delete this product" });

    if (product.images && Array.isArray(product.images)) {
      for (const image of product.images) {
        if (image.id) {
          try {
            await axios.delete(
              `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${image.id}`,
              { headers: { "X-Appwrite-Project": process.env.APPWRITE_PROJECT_ID, "X-Appwrite-Key": process.env.APPWRITE_API_KEY } }
            );
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



// Admin product list (table with delete/update buttons)
// ---- GET ALL PRODUCTS FOR ADMIN (COMPANY ISOLATED) ----
router.get("/admin", isAdmin, async (req, res) => {
  try {
    const products = await Product.find({ companyId: req.user.companyId })
      .populate({
        path: "createdBy",
        select: "companyId",
        populate: { path: "companyId", select: "name" } // nested populate for company name
      });

    // Map products to include uploaderCompanyName directly
    const result = products.map(p => ({
      ...p.toObject(),
      uploaderCompanyName: p.createdBy?.companyId?.name || "Unknown"
    }));

    console.log(`✅ [GET /products/admin] Found ${products.length} products for company ${req.user.companyId}`);
    res.status(200).json(result);
  } catch (error) {
    console.error("❌ [GET /products/admin] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});


// ---- GET SINGLE PRODUCT ----
router.get("/:id", async (req, res) => {
  console.log("📥 [GET /products/:id] Fetch single product request:", req.params.id);
  try {
    // Nested population: get uploader's company name
    const product = await Product.findById(req.params.id)
      .populate({
        path: "createdBy",
        select: "companyId",
        populate: { path: "companyId", select: "name" } // populate the company name
      });

    if (!product) {
      console.warn("⚠️ [GET /products/:id] Product not found");
      return res.status(404).json({ message: "Product not found" });
    }

    // Add uploaderCompanyName directly to the response
    const response = {
      ...product.toObject(),
      uploaderCompanyName: product.createdBy?.companyId?.name || "Unknown"
    };

    console.log("✅ [GET /products/:id] Product found:", product._id);
    res.status(200).json(response);
  } catch (error) {
    console.error("❌ [GET /products/:id] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// ---- GET PRODUCTS BY CATEGORY ----
router.get("/category/:category", async (req, res) => {
  console.log("📥 [GET /products/category/:category] Fetch products for category:", req.params.category);
  try {
    // Nested population: get uploader's company name
    const products = await Product.find({ category: req.params.category }).populate({
      path: "createdBy",
      select: "companyId",
      populate: { path: "companyId", select: "name" } // populate company name
    });

    // Transform response to include uploaderCompanyName
    const response = products.map(product => ({
      ...product.toObject(),
      uploaderCompanyName: product.createdBy?.companyId?.name || "Unknown"
    }));

    console.log(`✅ [GET /products/category/:category] Found ${products.length} products`);
    res.status(200).json(response);
  } catch (error) {
    console.error("❌ [GET /products/category/:category] Error:", error.message);
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