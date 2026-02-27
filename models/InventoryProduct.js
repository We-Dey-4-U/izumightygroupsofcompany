const mongoose = require("mongoose");

// Generate unique product code
const generateProductCode = () => {
  return `PRD-${Math.floor(100000 + Math.random() * 900000)}`;
};

const inventoryProductSchema = new mongoose.Schema(
  {
    // 🔹 MULTI-TENANT ISOLATION (MATCH PAYROLL)
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true
    },

    name: { type: String, required: true },
    productModel: { type: String, required: true },

    productCode: {
      type: String,
      unique: true,
      default: generateProductCode,
      immutable: true
    },

 category: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "InventoryCategory",
  required: true
},
    image: String,

    costPrice: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },

    quantityInStock: { type: Number, default: 0 },
   // itemsSold: { type: Number, default: 0 },

   // itemsAvailable: {
    //  type: Number,
    //  default: function () {
       // return this.quantityInStock - this.itemsSold;
      //}
   // },
     totalSold: { type: Number, default: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

// Auto-update available items
//inventoryProductSchema.pre("save", function (next) {
 // this.itemsAvailable = this.quantityInStock - this.itemsSold;
  //next();
//});

module.exports = mongoose.model("InventoryProduct", inventoryProductSchema);