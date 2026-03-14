require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const InventoryProduct = require("./models/InventoryProduct");
const InventoryCategory = require("./models/InventoryCategory");
const StoreInventory = require("./models/StoreInventory");
const Store = require("./models/Store");

if (!process.env.CONNECTION_STRING) {
  console.error("❌ CONNECTION_STRING missing in .env");
  process.exit(1);
}

const COMPANY_ID = "69934576cb826ddfd7a54543";
const CREATED_BY = "69937290cb826ddfd7a54ab4";

const products = [

// ===== NEWLY ADDED PRODUCTS (228–269) ======
{ name: "Arpers SFP-10G-LR-COM", productModel: "", category: "Network Accessories", sellingPrice: 1000 },
{ name: "HDTV 2.0 60Hz AOC (Active Optica Cable) 4K UHD || 50m", productModel: "", category: "Cable", sellingPrice: 1500 },
{ name: "Fargo Smartload Ribbon Cartridge || 045000", productModel: "045000", category: "Printer Accessories", sellingPrice: 2200 },
{ name: "Fargo Smartload Ribbon Cartridge ||045106", productModel: "045106", category: "Printer Accessories", sellingPrice: 2200 },
{ name: "HP Small Keyboard - 500 Series", productModel: "", category: "Keyboard", sellingPrice: 500 },
{ name: "HP Small Keyboard - 700 Series", productModel: "", category: "Keyboard", sellingPrice: 700 },
{ name: "DELL small Keyboard - 500 Series", productModel: "", category: "Keyboard", sellingPrice: 500 },
{ name: "DELL small Keyboard - 700 Series", productModel: "", category: "Keyboard", sellingPrice: 700 },
{ name: "DELL Big Keyboard - 500 Series", productModel: "", category: "Keyboard", sellingPrice: 500 },
{ name: "DELL Big Keyboard - 700 Series", productModel: "", category: "Keyboard", sellingPrice: 700 },
{ name: "LENOVO Big Keyboard - 700 Series", productModel: "", category: "Keyboard", sellingPrice: 700 },
{ name: "LENOVO Big Keyboard - 500 Series", productModel: "", category: "Keyboard", sellingPrice: 500 },
{ name: "LENOVO Big Keyboard - 1200 Series", productModel: "", category: "Keyboard", sellingPrice: 1200 },
{ name: "LENOVO Small keyboard - 1200 Series", productModel: "", category: "Keyboard", sellingPrice: 1200 },
{ name: "LENOVO Small keyboard - 700 Series", productModel: "", category: "Keyboard", sellingPrice: 700 },
{ name: "LENOVO Small keyboard - 500 Series", productModel: "", category: "Keyboard", sellingPrice: 500 },
{ name: "SAMSUNG Big Keyboard - 500 Series", productModel: "", category: "Keyboard", sellingPrice: 500 },
{ name: "SAMSUNG Big Keyboard - 700 Series", productModel: "", category: "Keyboard", sellingPrice: 700 },
{ name: "SAMSUNG Small keyboard - 500 Series", productModel: "", category: "Keyboard", sellingPrice: 500 },
{ name: "ACER Normal keyboard - 500 Series", productModel: "", category: "Keyboard", sellingPrice: 500 },
{ name: "ACER Big keyboard - 500 Series", productModel: "", category: "Keyboard", sellingPrice: 500 },
{ name: "ACER Big keyboard - 700 Series", productModel: "", category: "Keyboard", sellingPrice: 700 },
{ name: "ASUS Small Keyboard - 500 Series", productModel: "", category: "Keyboard", sellingPrice: 500 },
{ name: "ASUS Big keyboard - 700 Series", productModel: "", category: "Keyboard", sellingPrice: 700 },
{ name: "TOSHIBA Small keyboard - 500 Series", productModel: "", category: "Keyboard", sellingPrice: 500 },
{ name: "TOSHIBA Small keyboard - 1200 Series", productModel: "", category: "Keyboard", sellingPrice: 1200 },
{ name: "SONY Big keyboard - 700 Series", productModel: "", category: "Keyboard", sellingPrice: 700 },

{ name: "DELL Laptop Battery - F3YGT", productModel: "F3YGT", category: "Laptop Battery", sellingPrice: 1300 },
{ name: "DELL Laptop Battery - 6MT4T", productModel: "6MT4T", category: "Laptop Battery", sellingPrice: 1300 },
{ name: "DELL Laptop Battery - F3G33", productModel: "F3G33", category: "Laptop Battery", sellingPrice: 1300 },
{ name: "DELL Laptop Battery - G5M10", productModel: "G5M10", category: "Laptop Battery", sellingPrice: 1300 },
{ name: "DELL Laptop Battery - G(1JO", productModel: "G91JO", category: "Laptop Battery", sellingPrice: 1200 },
{ name: "DELL Laptop Battery - E7440-47WH", productModel: "E7440-47WH", category: "Laptop Battery", sellingPrice: 1200 },
{ name: "DELL Laptop Battery - E7240-52WH", productModel: "E7240-52WH", category: "Laptop Battery", sellingPrice: 1300 },
{ name: "DELL Laptop Battery - 51KD7", productModel: "51KD7", category: "Laptop Battery", sellingPrice: 1300 },
{ name: "DELL Battery - JK6Y6", productModel: "JK6Y6", category: "Laptop Battery", sellingPrice: 1300 },
{ name: "DELL Laptop Battery - YRDD6", productModel: "YRDD6", category: "Laptop Battery", sellingPrice: 1200 },
{ name: "DELL Laptop Battery - WDXOR", productModel: "WDXOR", category: "Laptop Battery", sellingPrice: 1400 },
{ name: "DELL Laptop Battery - 3HWPP", productModel: "3HWPP", category: "Laptop Battery", sellingPrice: 1400 },
{ name: "DELL Battery - 3HWPP", productModel: "93FTF-GJKNK", category: "Laptop Battery", sellingPrice: 1300 },
{ name: "DELL Battery - J60J5", productModel: "J60J5", category: "Laptop Battery", sellingPrice: 1300 },
{ name: "DELL Laptop Battery - DG74G", productModel: "DG74G", category: "Laptop Battery", sellingPrice: 1300 },
{ name: "DELL Laptop Battery - 51KD70", productModel: "51KD70", category: "Laptop Battery", sellingPrice: 1300 },
{ name: "DELL Laptop Battery - OPD19-TRHFF", productModel: "OPD19-TRHFF", category: "Laptop Battery", sellingPrice: 1200 },
{ name: "DELL Laptop Battery - 9JM71", productModel: "9JM71", category: "Laptop Battery", sellingPrice: 1200 },
{ name: "DELL Battery - 2NJNF", productModel: "2NJNF", category: "Laptop Battery", sellingPrice: 1300 },
{ name: "DELL Laptop Battery - NYFJH", productModel: "NYFJH", category: "Laptop Battery", sellingPrice: 1300 },
{ name: "DELL Laptop Battery - DXGH8", productModel: "DXGH8", category: "Laptop Battery", sellingPrice: 1500 },

{ name: "HP Laptop Battery - B103", productModel: "B103", category: "Laptop Battery", sellingPrice: 1200 },
{ name: "HP Laptop Battery - SB03XL", productModel: "SB03XL", category: "Laptop Battery", sellingPrice: 1300 },
{ name: "HP Laptop Battery - ME03XL", productModel: "ME03XL", category: "Laptop Battery", sellingPrice: 1200 },
{ name: "HP Laptop Battery - CM03XI", productModel: "CM03XI", category: "Laptop Battery", sellingPrice: 1200 },
{ name: "HP Laptop Battery - CI03XI", productModel: "CI03XI", category: "Laptop Battery", sellingPrice: 1200 },
{ name: "HP Laptop Battery - KC04XI", productModel: "KC04XI", category: "Laptop Battery", sellingPrice: 1500 },
{ name: "HP Laptop Battery - SNO3XI", productModel: "SNO3XI", category: "Laptop Battery", sellingPrice: 1200 },
{ name: "HP Laptop Battery - BK03XI", productModel: "BK03XI", category: "Laptop Battery", sellingPrice: 1200 },
{ name: "HP Laptop Battery - CS03XL", productModel: "CS03XL", category: "Laptop Battery", sellingPrice: 1200 },
{ name: "HP Laptop Battery - RR04", productModel: "RR04", category: "Laptop Battery", sellingPrice: 1200 },
{ name: "HP Laptop Battery - SSO3", productModel: "SSO3", category: "Laptop Battery", sellingPrice: 1300 },
{ name: "HP - Laptop Battery - POO2", productModel: "POO2", category: "Laptop Battery", sellingPrice: 1300 },
{ name: "HP Laptop Battery - RR3XL", productModel: "RR3XL", category: "Laptop Battery", sellingPrice: 1300 },
{ name: "HP Laptop Battery - BTO4XL", productModel: "BTO4XL", category: "Laptop Battery", sellingPrice: 1200 },

{ name: "LENOVO Laptop Battery - L18MGPD1", productModel: "L18MGPD1", category: "Laptop Battery", sellingPrice: 1300 },
{ name: "LENOVO Laptop Battery - 1005", productModel: "1005", category: "Laptop Battery", sellingPrice: 1200 },
{ name: "LENOVO Laptop Battery - 01AV421", productModel: "01AV421", category: "Laptop Battery", sellingPrice: 1200 },
{ name: "LENOVO Laptop Battery - Y280", productModel: "Y280", category: "Laptop Battery", sellingPrice: 1300 },

{ name: "ASUS Battery - C31N1912", productModel: "C31N1912", category: "Laptop Battery", sellingPrice: 1300 },
{ name: "ASUS Battery - C21N1629", productModel: "C21N1629", category: "Laptop Battery", sellingPrice: 1300 },

{ name: "ACER Laptop Battery - AC14B18J", productModel: "AC14B18J", category: "Laptop Battery", sellingPrice: 1200 },
{ name: "ACER Laptop Battery - AP16M5J", productModel: "AP16M5J", category: "Laptop Battery", sellingPrice: 1200 },
{ name: "ACER Laptop Battery - AC14B81L", productModel: "AC14B81L", category: "Laptop Battery", sellingPrice: 1200 },
{ name: "ACER Laptop Battery - ALKA32", productModel: "ALKA32", category: "Laptop Battery", sellingPrice: 1200 },

{ name: "Laptop Battery - 500 Series", productModel: "", category: "Laptop Battery", sellingPrice: 500 },
{ name: "Laptop Battery - 700 Series", productModel: "", category: "Laptop Battery", sellingPrice: 700 },
{ name: "Laptop Battery - 1000 Series", productModel: "", category: "Laptop Battery", sellingPrice: 1000 },
{ name: "Laptop Battery - 1200 Series", productModel: "", category: "Laptop Battery", sellingPrice: 1200 },

{ name: "Zebra True Colors", productModel: "", category: "Printer Accessories", sellingPrice: 0 },
{ name: "Fargo TTF Overlaminate || 082615", productModel: "082615", category: "Printer Accessories", sellingPrice: 0 },
{ name: "Fargo DTC Resin Ribbon || 045202", productModel: "045202", category: "Printer Accessories", sellingPrice: 0 },
{ name: "Frago HDP Retransfer Film || 084053", productModel: "084053", category: "Printer Accessories", sellingPrice: 0 },

{ name: "RJ11 Patch Cord || 3m", productModel: "", category: "Patch cord", sellingPrice: 0 },
{ name: "Coaxial BNC Connector Gold", productModel: "", category: "CCTV Accessories", sellingPrice: 0 },
{ name: "VGA to RJ45 Adaptor", productModel: "", category: "PC Accessories", sellingPrice: 0 },
{ name: "Mouse Adaptor || male to USB", productModel: "", category: "PC Accessories", sellingPrice: 0 },
{ name: "DVI-1 to VGA adaptor || female to male", productModel: "", category: "PC Accessories", sellingPrice: 0 },
{ name: "DVI-1 (male) to HDMI adaptor", productModel: "", category: "PC Accessories", sellingPrice: 0 },
{ name: "RJ45 Spliter adaptor || 1x2", productModel: "", category: "PC Accessories", sellingPrice: 0 },
{ name: "DVI-1 to VGA adaptor || male to female", productModel: "", category: "PC Accessories", sellingPrice: 0 },
{ name: "VGA to VGA coupler || male to male", productModel: "", category: "PC Accessories", sellingPrice: 0 },
{ name: "VGA to VGA coupler || female to female", productModel: "", category: "PC Accessories", sellingPrice: 0 },
{ name: "RJ11", productModel: "", category: "IP Phone", sellingPrice: 0 },
{ name: "9 Pin DB9-DR9 VGA Adaptor", productModel: "", category: "PC Accessories", sellingPrice: 0 },
{ name: "Cable clip || 8mm | 100pcs Pack", productModel: "", category: "General Accessories", sellingPrice: 0 },

{ name: "15.6 Slim Touch screen small connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 3500 },
{ name: "15.6 Slim big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "14.0 Slim small connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 3500 },
{ name: "15.6 Normal 30 pin || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "15.6 Slim small connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "14.0 Super Slim big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "15.4 Normal inverter big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "14.0 Normal small connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "17.3 Normal big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "14.1 Normal inverter big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "14.0 Normal big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "12.5 Slim Big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "12.5 Slim small connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "13.3 Slim Big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "13.3 Big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "12.1 Normal inverter small connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "11.6 Normal Big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "11.6 Slim small connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "10.1 Normal Big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 },
{ name: "10.1 Slim big connector || Laptop Screen", productModel: "", category: "Laptop Screen", sellingPrice: 0 }



];



const seedProducts = async () => {
  try {
    await mongoose.connect(process.env.CONNECTION_STRING);
    console.log("✅ Connected to MongoDB");

    // 🔥 GET ALL CATEGORIES
    const categories = await InventoryCategory.find({ companyId: COMPANY_ID });

    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.name] = cat._id;
    });

    const formattedProducts = [];

    for (const item of products) {

      const categoryId = categoryMap[item.category];

      if (!categoryId) {
        console.log(`❌ Category not found: ${item.category}`);
        continue;
      }

      // prevent duplicate (same name + model + company)
      const exists = await InventoryProduct.findOne({
        name: item.name,
        productModel: item.productModel,
        companyId: COMPANY_ID
      });

      if (exists) {
        console.log(`⚠ Already exists: ${item.name}`);
        continue;
      }

      formattedProducts.push({
        companyId: COMPANY_ID,
        name: item.name,
        productModel:
    item.productModel && item.productModel.trim() !== ""
      ? item.productModel.trim()
      : "MODEL-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        category: categoryId,
        costPrice: 0,
        sellingPrice: item.sellingPrice,
        quantityInStock: 0,
        totalSold: 0,
        createdBy: CREATED_BY
      });
    }

   if (formattedProducts.length > 0) {
  for (const item of formattedProducts) {
    // Insert product
    const productDoc = await InventoryProduct.create(item);

    // Get all stores for this company
    const stores = await Store.find({ companyId: COMPANY_ID });

    // Create StoreInventory rows for each store
    if (stores.length) {
      const ops = stores.map(store => ({
        updateOne: {
          filter: { store: store._id, product: productDoc._id },
          update: { $setOnInsert: { companyId: COMPANY_ID, quantity: 0 } },
          upsert: true
        }
      }));

      await StoreInventory.bulkWrite(ops);
    }
  }

  console.log("🎉 PRODUCTS INSERTED SUCCESSFULLY with store inventory!");
} else {
  console.log("⚠ No new products inserted.");
}

    process.exit(0);

  } catch (err) {
    console.error("❌ Error inserting products:", err);
    process.exit(1);
  }
};

seedProducts();