const express = require("express");
const router = express.Router();
const { auth, isAdmin, isSubAdmin, isSuperStakeholder } = require("../middleware/auth");
const Store = require("../models/Store");
const StoreInventory = require("../models/StoreInventory");
const InventoryProduct = require("../models/InventoryProduct");
const StockMovement = require("../models/StockMovement");
const InventoryCategory = require("../models/InventoryCategory");


async function createMissingInventoryForStore(storeId, companyId) {
  const products = await InventoryProduct.find({ companyId });

  if (!products.length) return;

  const ops = products.map(p => ({
    updateOne: {
      filter: { store: storeId, product: p._id },
      update: {
        $setOnInsert: {
          companyId,
          quantity: 0
        }
      },
      upsert: true
    }
  }));

  await StoreInventory.bulkWrite(ops);
}


// -------------------------------------------------
// CREATE PRODUCT (auto-create PACKING store inventory)
// -------------------------------------------------

// -------------------------------------------------
// CREATE PRODUCT (AUTO CREATE INVENTORY FOR ALL STORES)
// -------------------------------------------------
router.post("/product", auth, async (req, res) => {
  try {
    // permission
    if (!req.user.isAdmin && !req.user.isSubAdmin && !req.user.isSuperStakeholder) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { name, productModel, category, image, costPrice, sellingPrice } = req.body;

    if (!name || !productModel || !category || !costPrice || !sellingPrice) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // create product
    const product = await InventoryProduct.create({
      companyId: req.user.companyId,
      name,
      productModel,
      category,
      image,
      costPrice,
      sellingPrice,
      totalSold: 0,
      createdBy: req.user._id
    });

    // 🔥 create inventory rows for ALL stores
    const stores = await Store.find({ companyId: req.user.companyId });

   if (stores.length > 0) {
  const ops = stores.map(store => ({
    updateOne: {
      filter: { store: store._id, product: product._id },
      update: {
        $setOnInsert: {
          companyId: req.user.companyId,
          quantity: 0
        }
      },
      upsert: true
    }
  }));

  await StoreInventory.bulkWrite(ops);
}

    res.status(201).json({
      message: "Product created successfully",
      product
    });

  } catch (err) {
    console.error("CREATE PRODUCT ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// -------------------------------------------------
// STOCK IN (ALL STORES)
// -------------------------------------------------
router.post("/stock-in/:productId", auth, async (req, res) => {
  try {
    if (!req.user.isSuperStakeholder && !req.user.isAdmin)
      return res.status(403).json({ message: "Not authorized" });

    const { storeId, quantity, description } = req.body;

    if (!storeId || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0)
      return res.status(400).json({ message: "Invalid store or quantity" });

    const product = await InventoryProduct.findOne({
      _id: req.params.productId,
      companyId: req.user.companyId
    });

    if (!product)
      return res.status(404).json({ message: "Product not found" });

    const record = await StoreInventory.findOneAndUpdate(
      { store: storeId, product: product._id, companyId: req.user.companyId },
      { $inc: { quantity: Number(quantity) } },
      { upsert: true, new: true }
    );

    await StockMovement.create({
      companyId: req.user.companyId,
      product: product._id,
      type: "STOCK_IN",
      quantity: Number(quantity),
      previousQuantity: record.quantity - quantity,
      newQuantity: record.quantity,
      description,
      performedBy: req.user._id,
      store: storeId
    });

    res.json({ message: "Stock added successfully", record });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -------------------------------------------------
// STOCK OUT (ALL STORES)
// -------------------------------------------------
// -------------------------------------------------
// STOCK OUT (ALL STORES)
// -------------------------------------------------
router.post("/stock-out/:productId", auth, async (req, res) => {
  try {
    const { storeId, quantity, description } = req.body;
    if (!storeId || !quantity) 
      return res.status(400).json({ message: "Missing storeId or quantity" });

    // ✅ Check store exists and is OFFICE
    const store = await Store.findById(storeId);
    if (!store) return res.status(404).json({ message: "Store not found" });
    if (store.type !== "OFFICE") {
      return res.status(400).json({ message: "Goods can only be sold from office stores" });
    }

    const product = await InventoryProduct.findOne({
      _id: req.params.productId,
      companyId: req.user.companyId
    });
    if (!product) 
      return res.status(404).json({ message: "Product not found or access denied" });

    const record = await StoreInventory.findOne({ store: storeId, product: product._id });
    if (!record || record.quantity < quantity) 
      return res.status(400).json({ message: "Insufficient stock" });

    record.quantity -= Number(quantity);
    await record.save();

    // Record stock movement
    await StockMovement.create({
      companyId: req.user.companyId,
      product: product._id,
      type: "STOCK_OUT",
      quantity,
      previousQuantity: record.quantity + quantity,
      newQuantity: record.quantity,
      description,
      performedBy: req.user._id,
      store: storeId
    });

    // Auto-update totalSold
    if (!product.totalSold) product.totalSold = 0;
    product.totalSold += Number(quantity);
    await product.save();

    res.json({ message: "Stock removed successfully", record });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// -------------------------------------------------
// GET ALL PRODUCTS WITH TOTAL STOCK
// -------------------------------------------------
router.get("/products", auth, async (req, res) => {
  try {
    const companyId = req.user.companyId;

    const products = await InventoryProduct.aggregate([
      { $match: { companyId } },

      {
        $lookup: {
          from: "storeinventories",
          let: { productId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$product", "$$productId"] } } },
            { $group: { _id: null, total: { $sum: "$quantity" } } }
          ],
          as: "stock"
        }
      },

      // ✅ keep old stored quantity
      {
        $addFields: {
          oldQuantityInStock: "$quantityInStock"
        }
      },

      // ✅ calculate new live quantity
      {
        $addFields: {
          quantityInStock: {
            $ifNull: [{ $arrayElemAt: ["$stock.total", 0] }, 0]
          }
        }
      },

      { $project: { stock: 0 } },
      { $sort: { createdAt: -1 } }
    ]);

    res.json(products.map(p => ({
      ...p,
      itemsSold: p.totalSold || 0
    })));

  } catch (err) {
    console.error("GET PRODUCTS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});



// =====================================================
// CREATE STORE
// =====================================================
// =====================================================
// CREATE STORE  ✅ FIXED VERSION
// =====================================================
router.post("/store", auth, async (req, res) => {
  try {
    // permission check
    if (!req.user.isSuperStakeholder)
      return res.status(403).json({ message: "Only supervisor can create stores" });

    const { name, type, location } = req.body;

    if (!name || !type)
      return res.status(400).json({ message: "Store name and type required" });

    // create store
    const store = await Store.create({
      companyId: req.user.companyId,
      name,
      type,
      location,
      createdBy: req.user._id
    });

    // 🔥 IMPORTANT — create inventory rows for ALL existing products
    await createMissingInventoryForStore(store._id, req.user.companyId);

    res.status(201).json(store);

  } catch (err) {
    console.error("CREATE STORE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});
// =====================================================
// GET STORES
// =====================================================
router.get("/stores", auth, async (req, res) => {
  const stores = await Store.find({ companyId: req.user.companyId });
  res.json(stores);
});



router.get("/product/:id/stores", auth, async (req, res) => {
  const rows = await StoreInventory.find({
    product: req.params.id,
    companyId: req.user.companyId
  }).populate("store", "name type");

  res.json(rows);
});



// =====================================================
// STOCK INTO STORE
// =====================================================
router.post("/store/stock-in", auth, async (req, res) => {

  if (!req.user.isSuperStakeholder && !req.user.isAdmin)
    return res.status(403).json({ message: "Only supervisors can modify store inventory" });

  const { storeId, productId, quantity } = req.body;

  const record = await StoreInventory.findOneAndUpdate(
    {
      store: storeId,
      product: productId,
      companyId: req.user.companyId
    },
    { $inc: { quantity: quantity } },
    { upsert: true, new: true }
  );

  res.json(record);
});




// =====================================================
// TRANSFER BETWEEN STORES OR DIRECTLY FROM WAREHOUSE
// =====================================================
router.post("/store/transfer", auth, async (req, res) => {
  try {
    const { fromStore, toStore, productId, quantity } = req.body;

    if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0)
      return res.status(400).json({ message: "Invalid quantity" });

    // Validate toStore
    const to = await Store.findOne({ _id: toStore, companyId: req.user.companyId });
    if (!to) return res.status(400).json({ message: "Invalid destination store" });

    let from;
    if (fromStore) {
      from = await Store.findOne({ _id: fromStore, companyId: req.user.companyId });
      if (!from)
        return res.status(400).json({ message: "Invalid source store" });

      if (from.type !== "PACKING" && from.type !== "WAREHOUSE")
        return res.status(400).json({ message: "Stock must come from packing or warehouse store" });
    }

    // Only check stock if there's a source store
    if (from) {
      const source = await StoreInventory.findOne({ store: fromStore, product: productId });
      if (!source || source.quantity < quantity)
        return res.status(400).json({ message: "Insufficient stock" });

      source.quantity -= Number(quantity);
      await source.save();
    }

    // Add stock to destination
    const dest = await StoreInventory.findOneAndUpdate(
      { store: toStore, product: productId },
      { $inc: { quantity: Number(quantity) } },
      { upsert: true, new: true }
    );

    res.json({ message: "Transferred successfully", from: from || null, to: dest });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// =====================================================
// TOTAL STOCK ACROSS ALL STORES
// =====================================================
router.get("/stock/all", auth, async (req, res) => {

  const data = await StoreInventory.aggregate([
    { $match: { companyId: req.user.companyId } },

    {
      $lookup: {
        from: "inventoryproducts",
        localField: "product",
        foreignField: "_id",
        as: "product"
      }
    },

    { $unwind: "$product" },

    {
      $group: {
        _id: "$product._id",
        name: { $first: "$product.name" },
        totalQuantity: { $sum: "$quantity" }
      }
    }
  ]);

  res.json(data);
});




// -------------------------------------------------
// GET STOCK HISTORY
// -------------------------------------------------
// -------------------------------------------------
// GET STOCK HISTORY (OPTIONAL STORE FILTER)
// -------------------------------------------------
router.get("/history/:productId", auth, async (req, res) => {
  try {
    const { storeId } = req.query; // optional filter
    const product = await InventoryProduct.findOne({
      _id: req.params.productId,
      companyId: req.user.companyId
    });
    if (!product) return res.status(404).json({ message: "Product not found or access denied" });

    const filter = { product: product._id, companyId: req.user.companyId };
    if (storeId) filter.store = storeId;

    const history = await StockMovement.find(filter)
      .populate("performedBy", "name email")
      .populate("store", "name type")
      .sort({ createdAt: -1 });

    res.json(history);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -------------------------------------------------
// UPDATE ITEMS SOLD
// -------------------------------------------------
// -------------------------------------------------
// UPDATE ITEMS SOLD
// -------------------------------------------------
router.patch("/update-sold/:productId", auth, async (req, res) => {
  try {
    // ✅ Permission check: Only supervisors/admins
    if (!req.user.isSuperStakeholder && !req.user.isAdmin) {
      return res.status(403).json({ message: "Only supervisors can update sold items" });
    }

    const { itemsSold } = req.body;

    const product = await InventoryProduct.findOne({
      _id: req.params.productId,
      companyId: req.user.companyId
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found or access denied" });
    }

    // Optional: If tracking per-store stock, remove quantityInStock check
    product.totalSold = Number(itemsSold);
    await product.save();

    res.json({ message: "Product updated", product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});




router.patch("/product/:productId", auth, async (req, res) => {
  try {
    if (!req.user.isSuperStakeholder && !req.user.isAdmin)
      return res.status(403).json({ message: "Access denied" });

    const { name, productModel, category, image, costPrice, sellingPrice } = req.body;

    const product = await InventoryProduct.findOne({
      _id: req.params.productId,
      companyId: req.user.companyId
    });

    if (!product) return res.status(404).json({ message: "Product not found" });

    const { stores, ...fields } = req.body;  // extract per-store quantities
Object.assign(product, fields);
await product.save();

if (stores) {
  for (const [storeId, qty] of Object.entries(stores)) {
    await StoreInventory.findOneAndUpdate(
      { store: storeId, product: product._id },
      { $set: { quantity: qty } },
      { upsert: true }
    );
  }
}

// fetch updated store quantities
const storeRows = await StoreInventory.find({
  product: product._id,
  companyId: req.user.companyId
}).populate("store", "name type");

res.json({
  message: "Product updated successfully",
  product: {
    ...product._doc,
    itemsSold: product.totalSold || 0
  },
  stores: storeRows
});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



router.delete("/product/:productId", auth, async (req, res) => {
  try {
    if (!req.user.isSuperStakeholder && !req.user.isAdmin)
      return res.status(403).json({ message: "Access denied" });

    const product = await InventoryProduct.findOneAndDelete({
      _id: req.params.productId,
      companyId: req.user.companyId
    });

    if (!product) return res.status(404).json({ message: "Product not found" });

    // Optionally remove all StoreInventory entries
    await StoreInventory.deleteMany({ product: product._id, companyId: req.user.companyId });

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



router.post("/category", auth, async (req, res) => {
  try {
    if (!req.user.isSuperStakeholder && !req.user.isAdmin)
      return res.status(403).json({ message: "Access denied" });

    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Name required" });

    const exists = await InventoryCategory.findOne({
      name,
      companyId: req.user.companyId
    });

    if (exists)
      return res.status(400).json({ message: "Category already exists" });

    const category = await InventoryCategory.create({
      name,
      companyId: req.user.companyId,
      createdBy: req.user._id
    });

    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get("/categories", auth, async (req, res) => {
  const categories = await InventoryCategory.find({
    companyId: req.user.companyId
  }).sort({ name: 1 });

  res.json(categories);
});


// -------------------------------------------------
// MONTHLY INVENTORY SUMMARY (PAYROLL STYLE)
// -------------------------------------------------
router.get("/summary/monthly", auth, async (req, res) => {
  try {
    const summary = await StockMovement.aggregate([
      { $match: { companyId: req.user.companyId } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            type: "$type"
          },
          totalQuantity: { $sum: "$quantity" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const formatted = summary.reduce((acc, row) => {
      const key = `${row._id.year}-${row._id.month}`;
      if (!acc[key]) acc[key] = { STOCK_IN: 0, STOCK_OUT: 0 };
      acc[key][row._id.type] = row.totalQuantity;
      return acc;
    }, {});

    const productsSold = await InventoryProduct.find({
      companyId: req.user.companyId
    }).select("name itemsSold");

    res.json({
      monthlySummary: formatted,
      productsSold
    });
  } catch (err) {
    console.error("❌ INVENTORY SUMMARY ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;