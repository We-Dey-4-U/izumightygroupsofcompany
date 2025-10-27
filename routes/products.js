require("dotenv").config();
const { Product } = require("../models/product");
const { isAdmin } = require("../middleware/auth");
const router = require("express").Router();
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const { v4: uuidv4 } = require("uuid");

// ---- 🧠 Appwrite Connectivity Check ----
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
router.post("/", isAdmin, upload.array("images"), async (req, res) => {
   console.log("Incoming files:", req.files?.length, req.files?.map(f => f.originalname));
  console.log("Headers:", req.headers["content-type"]);
  console.log("Body keys:", Object.keys(req.body));
  console.log("🟢 [POST /products] Request received");
  try {
    const { name, category, desc, price, originalPrice, rating } = req.body;
    console.log("📦 Product data received:", req.body);

    if (!req.files || req.files.length === 0) {
      console.warn("⚠️ [POST /products] No files uploaded");
      return res.status(400).json({ message: "No images uploaded" });
    }

    console.log(`📸 [POST /products] Uploading ${req.files.length} images...`);
    const images = await Promise.all(req.files.map((file) => uploadToAppwrite(file)));
    console.log("✅ [POST /products] Uploaded all images:", images);

    const product = new Product({
      name,
      category,
      desc,
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      rating: rating ? Number(rating) : undefined,
      images,
    });

    console.log("💾 [POST /products] Saving product to database...");
    const savedProduct = await product.save();
    console.log("✅ [POST /products] Product saved successfully:", savedProduct._id);

    res.status(200).json(savedProduct);
  } catch (error) {
    console.error("❌ [POST /products] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// ---- UPDATE PRODUCT ----
router.put("/:id", isAdmin, upload.array("images"), async (req, res) => {
  console.log("🟡 [PUT /products/:id] Update request received for ID:", req.params.id);
  try {
    const updateData = { ...req.body };
    console.log("📦 Update data:", updateData);

    if (req.files && req.files.length > 0) {
      console.log(`📸 [PUT /products/:id] Uploading ${req.files.length} new images...`);
      const images = await Promise.all(req.files.map((file) => uploadToAppwrite(file)));
      updateData.images = images;
      console.log("✅ [PUT /products/:id] Uploaded new images:", images);
    }

    if (updateData.price) updateData.price = Number(updateData.price);
    if (updateData.originalPrice) updateData.originalPrice = Number(updateData.originalPrice);
    if (updateData.rating) updateData.rating = Number(updateData.rating);

    console.log("💾 [PUT /products/:id] Updating database record...");
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    console.log("✅ [PUT /products/:id] Update complete:", updatedProduct?._id);

    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error("❌ [PUT /products/:id] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// ---- DELETE PRODUCT ----
router.delete("/:id", isAdmin, async (req, res) => {
  console.log("🔴 [DELETE /products/:id] Delete request for ID:", req.params.id);
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      console.warn("⚠️ [DELETE /products/:id] Product not found");
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.images && Array.isArray(product.images)) {
      console.log(`🗑️ [DELETE /products/:id] Deleting ${product.images.length} images from Appwrite...`);
      for (const image of product.images) {
        if (image.id) {
          try {
            await axios.delete(
              `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${image.id}`,
              {
                headers: {
                  "X-Appwrite-Project": process.env.APPWRITE_PROJECT_ID,
                  "X-Appwrite-Key": process.env.APPWRITE_API_KEY,
                },
              }
            );
            console.log(`✅ Deleted image ${image.id} from Appwrite`);
          } catch (err) {
            console.warn(`⚠️ Error deleting image ${image.id}:`, err.message);
          }
        }
      }
    }

    console.log("💾 [DELETE /products/:id] Removing product from MongoDB...");
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    console.log("✅ [DELETE /products/:id] Product deleted successfully");

    res.status(200).json(deletedProduct);
  } catch (error) {
    console.error("❌ [DELETE /products/:id] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// ---- GET ALL PRODUCTS ----
router.get("/", async (req, res) => {
  console.log("📥 [GET /products] Fetch all products request");
  try {
    const products = await Product.find();
    console.log(`✅ [GET /products] Found ${products.length} products`);
    res.status(200).json(products);
  } catch (error) {
    console.error("❌ [GET /products] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// ---- GET SINGLE PRODUCT ----
router.get("/:id", async (req, res) => {
  console.log("📥 [GET /products/:id] Fetch single product request:", req.params.id);
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      console.warn("⚠️ [GET /products/:id] Product not found");
      return res.status(404).json({ message: "Product not found" });
    }
    console.log("✅ [GET /products/:id] Product found:", product._id);
    res.status(200).json(product);
  } catch (error) {
    console.error("❌ [GET /products/:id] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// ---- GET PRODUCTS BY CATEGORY ----
router.get("/category/:category", async (req, res) => {
  console.log("📥 [GET /products/category/:category] Fetch products for category:", req.params.category);
  try {
    const products = await Product.find({ category: req.params.category });
    console.log(`✅ [GET /products/category/:category] Found ${products.length} products`);
    res.status(200).json(products);
  } catch (error) {
    console.error("❌ [GET /products/category/:category] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});





router.get("/og/product/:id", async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).send("Product not found");

  let imageUrl = `${process.env.FRONTEND_URL}/placeholder.png`;
  if (product.images?.length) {
    const img = product.images[0];
    imageUrl = img.id
      ? `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${img.id}/view?project=${process.env.APPWRITE_PROJECT_ID}`
      : img.url;
  }

  const escapeHTML = (str) =>
    str.replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;")
       .replace(/'/g, "&#39;");

  res.set("Content-Type", "text/html");
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHTML(product.name)} | CrushBanna</title>
      <meta property="og:title" content="${escapeHTML(product.name)}" />
      <meta property="og:description" content="${escapeHTML(product.desc)}" />
      <meta property="og:image" content="${imageUrl}" />
      <meta property="og:url" content="${process.env.FRONTEND_URL}/product/${product._id}" />
      <meta property="og:type" content="product" />
    </head>
    <body>
      <h1>${escapeHTML(product.name)}</h1>
      <img src="${imageUrl}" />
    </body>
    </html>
  `);
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