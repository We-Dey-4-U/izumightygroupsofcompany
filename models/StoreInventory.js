const mongoose = require("mongoose");

const storeInventorySchema = new mongoose.Schema({

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true
  },

  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
    required: true
  },

  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "InventoryProduct",
    required: true
  },

  quantity: {
    type: Number,
    default: 0
  }

}, { timestamps: true });

storeInventorySchema.index({ store: 1, product: 1 }, { unique: true });
storeInventorySchema.index({ companyId: 1, store: 1, product: 1 });
module.exports = mongoose.model("StoreInventory", storeInventorySchema);