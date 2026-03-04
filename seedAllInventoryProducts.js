require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const InventoryProduct = require("./models/InventoryProduct");

if (!process.env.CONNECTION_STRING) {
  console.error("❌ CONNECTION_STRING missing in .env");
  process.exit(1);
}

const COMPANY_ID = "69934576cb826ddfd7a54543";
const CREATED_BY = "69937290cb826ddfd7a54ab4";

const products = [
  // 🔵 ROUTERS
  { name: "TP-Link 300 Mbps Wireless N Router", productModel: "TL-WR841N", category: "Router", sellingPrice: 700 },
  { name: "TP-Link 300 Mbps Multi-Mode Wi-Fi Router", productModel: "TL-WR844N", category: "Router", sellingPrice: 700 },
  { name: "TP-Link AC750 Dual Band Wi-Fi Router", productModel: "Archer C24", category: "Router", sellingPrice: 1000 },
  { name: "TP-Link AC1200 Wi-Fi Router Dual Band", productModel: "Archer C50", category: "Router", sellingPrice: 1500 },
  { name: "TP-Link AX1500 Next-Gen Wi-Fi 6 Router", productModel: "Archer AX12", category: "Router", sellingPrice: 2000 },
  { name: "TP-Link AC1200 Wireless Access Point Router Dual Band", productModel: "TL-WA1201", category: "Router", sellingPrice: 2000 },
  { name: "Linksys WR1900 ACS Dual-Band Gigabit Wi-Fi Router", productModel: "WRT1900ACS-ME", category: "Router", sellingPrice: 2000 },
  { name: "TP-Link 3G/4G Wireless N Router", productModel: "TL-MR3420", category: "Router", sellingPrice: 2200 },
  { name: "TP-Link AX1500 Next-Gen Wi-Fi 6 Router", productModel: "Archer AX17", category: "Router", sellingPrice: 2300 },
  { name: "TP-Link AC1900 Wi-Fi Router Dual Band", productModel: "Archer C80", category: "Router", sellingPrice: 2500 },
  { name: "TP-Link AX3000 Dual Band Gigabit Wi-Fi 6 Router", productModel: "Archer AX53", category: "Router", sellingPrice: 3300 },
  { name: "Linksys Hydra 6 WiFi 6 Dual-Band Mesh Router", productModel: "MR2000-KE", category: "Router", sellingPrice: 5500 },

  // 🟢 SWITCHES
  { name: "TP-Link 5-Port Gigabit Desktop Switch", productModel: "TL-SG105", category: "Switch", sellingPrice: 1200 },
  { name: "TP-Link 5-Port 10/100 Mbps Desktop PoE+ Switch", productModel: "TL-SF1005P", category: "Switch", sellingPrice: 1200 },
  { name: "ExtraLink Euros V2 Switch", productModel: "5903148914831", category: "Switch", sellingPrice: 1500 },
  { name: "ExtraLink Ceres Switch", productModel: "5902560363906", category: "Switch", sellingPrice: 2500 },
  { name: "TP-Link 24-Port 10/100Mbps Desktop/Rackmount Switch", productModel: "TL-SF1024D", category: "Switch", sellingPrice: 2800 },
  { name: "D-Link 8 Port PoE Switch", productModel: "DGS-1100-08P", category: "Switch", sellingPrice: 3000 },
  { name: "D-Link 8 Port PoE Switch", productModel: "DGS-1100-08PV2", category: "Switch", sellingPrice: 3000 },
  { name: "TP-Link 24-Port Gigabit Desktop/Rackmount Switch", productModel: "LS1024G", category: "Switch", sellingPrice: 3500 },
  { name: "TP-Link 10-Port Gigabit Desktop PoE+ Switch", productModel: "LS1210GP", category: "Switch", sellingPrice: 3500 },
  { name: "TP-Link Omada 10-Port Gigabit Smart Switch", productModel: "SG2210MP", category: "Switch", sellingPrice: 8500 },
  { name: "D-Link 26 Port Gigabit Unmanaged PoE Switch", productModel: "DGS-F1024P", category: "Switch", sellingPrice: 9500 },
  { name: "Cisco Catalyst 2960-X 24-Port PoE+ Switch", productModel: "WS-C2960X-24PS-L", category: "Switch", sellingPrice: 28500 },

  // 🟣 WIRELESS ACCESS POINTS
  { name: "TP-Link Omada Wi-Fi 6 Ceiling Mount Access Point", productModel: "EAP610", category: "Wireless Access Point", sellingPrice: 3200 },
  { name: "D-Link Managed Wireless Access Point", productModel: "DWL-3200AP", category: "Wireless Access Point", sellingPrice: 2500 },

  // 🟡 PRINTERS
  { name: "HP Plug and Print DeskJet 2320", productModel: "7WN42B", category: "Printer", sellingPrice: 1000 },
  { name: "EPSON TM-T20III-011 Thermal Printer", productModel: "C31CH51011A0", category: "Printer", sellingPrice: 1500 },
  { name: "EPSON EcoTank L3251", productModel: "C11CJ67419", category: "Printer", sellingPrice: 4300 },
  { name: "HP LaserJet Pro MFP M130a", productModel: "G3Q57A", category: "Printer", sellingPrice: 9500 },
  { name: "HP Laser MFP 135a", productModel: "4ZB82A", category: "Printer", sellingPrice: 10500 },
  { name: "HP Color LaserJet Pro MFP M182n", productModel: "7KW54A", category: "Printer", sellingPrice: 16500 },
  { name: "EPSON EcoTank L18050", productModel: "C11CK38403DA", category: "Printer", sellingPrice: 20500 },
  { name: "HP Color LaserJet Pro MFP M283fdw", productModel: "7KW75A", category: "Printer", sellingPrice: 21000 },

  // 🟠 MONEY COUNTERS
  { name: "Nigachi NC10 Mix Value", productModel: "NC-10 Mix", category: "Money Counter", sellingPrice: 8500 },
  { name: "Nigachi NC-35 UVMG", productModel: "NC-35", category: "Money Counter", sellingPrice: 8500 },
  { name: "Cassida USA Bill Counter", productModel: "Cassida 5520", category: "Money Counter", sellingPrice: 9500 },

  // 🔴 UPS
  { name: "APC Easy UPS 800VA", productModel: "BV800I-MSX", category: "UPS", sellingPrice: 3300 },
  { name: "APC Smart-UPS C 1000VA LCD", productModel: "SMC1000I", category: "UPS", sellingPrice: 12500 },

  // ⚫ OTHER DEVICES
  { name: "TP-Link AV200 Nano Powerline Adapter Starter Kit", productModel: "TL-PA2010KIT", category: "Power Adaptor", sellingPrice: 300 },
  { name: "Tp-Link Omada Gigabit PoE Splitter", productModel: "POE10R", category: "PoE Splitter", sellingPrice: 450 },
  { name: "D-Link Wireless N Network Camera", productModel: "DCS-930L", category: "Camera", sellingPrice: 550 },
  { name: "CanonScan LiDe 300 Colour Image Scanner", productModel: "2295C010[AB]", category: "Scanner", sellingPrice: 4500 },
  { name: "EasyPos Cash Drawer", productModel: "EPCD405", category: "POS", sellingPrice: 5500 },
  { name: "TP-Link Omada Gigabit Multi-Mode Media Converter", productModel: "MC200CM", category: "Networking Tool", sellingPrice: 2200 },
  { name: "Dell PowerEdge T30 Server", productModel: "Dell PowerEdge T30", category: "Server", sellingPrice: 35000 },
  { name: "Dell Optiplex 3080 Desktop", productModel: "D29M", category: "Desktop", sellingPrice: 0 },
  { name: "UFO Colorful Converter", productModel: "UFO6C-GE", category: "PDU", sellingPrice: 350 }
];

const seedProducts = async () => {
  try {
    await mongoose.connect(process.env.CONNECTION_STRING);
    console.log("✅ Connected to MongoDB");

    const formattedProducts = products.map((item) => ({
      companyId: COMPANY_ID,
      name: item.name,
      productModel: item.productModel,
      category: item.category,
      costPrice: 0,
      sellingPrice: item.sellingPrice,
      quantityInStock: 0,
      totalSold: 0,
      createdBy: CREATED_BY
    }));

    await InventoryProduct.insertMany(formattedProducts, { ordered: false });

    console.log("🎉 ALL PRODUCTS INSERTED SUCCESSFULLY!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error inserting products:", err);
    process.exit(1);
  }
};

seedProducts();