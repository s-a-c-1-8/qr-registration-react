// index.js - Simple QR Code Generator from CSV
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const QRCode = require("qrcode");
const sharp = require("sharp");

// Configuration
const CONFIG = {
  INPUT_CSV: "./userdata.csv",
  TEMPLATE_IMAGE: "./bg.jpeg",
  OUTPUT_DIR: "./output",
  QR_CODE_SIZE: 250,
  QR_POSITION_X: 225,
  QR_POSITION_Y: 940,
};

async function generateQRCode(code) {
  return await QRCode.toBuffer(code, {
    width: CONFIG.QR_CODE_SIZE,
    margin: 1,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

async function mergeAndSave(qrBuffer, code) {
  const backgroundBuffer = await fs.promises.readFile(CONFIG.TEMPLATE_IMAGE);
  const mergedImage = await sharp(backgroundBuffer)
    .composite([
      {
        input: qrBuffer,
        top: CONFIG.QR_POSITION_Y,
        left: CONFIG.QR_POSITION_X,
      },
    ])
    .png()
    .toBuffer();

  const outputPath = path.join(CONFIG.OUTPUT_DIR, `${code}.png`);
  await fs.promises.writeFile(outputPath, mergedImage);
  return outputPath;
}

async function processCSV() {
  console.log("🚀 Starting QR Code Generation\n");

  // Check files
  if (!fs.existsSync(CONFIG.INPUT_CSV)) {
    console.error(`❌ CSV not found: ${CONFIG.INPUT_CSV}`);
    return;
  }
  if (!fs.existsSync(CONFIG.TEMPLATE_IMAGE)) {
    console.error(`❌ Background not found: ${CONFIG.TEMPLATE_IMAGE}`);
    return;
  }

  // Create output directory
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
  }

  console.log(`📄 CSV: ${CONFIG.INPUT_CSV}`);
  console.log(`🖼️  BG: ${CONFIG.TEMPLATE_IMAGE}`);
  console.log(`📁 Output: ${CONFIG.OUTPUT_DIR}`);
  console.log("");

  let count = 0;
  let success = 0;

  return new Promise((resolve, reject) => {
    fs.createReadStream(CONFIG.INPUT_CSV)
      .pipe(csv())
      .on("data", async (row) => {
        // Process immediately
        count++;
        const code = row.code;

        console.log(`Processing #${count}: ${row.name} - ${code}`);

        try {
          // Generate QR
          const qrBuffer = await generateQRCode(code);

          // Merge with BG and save
          const outputPath = await mergeAndSave(qrBuffer, code);

          console.log(`  ✅ Saved: ${path.basename(outputPath)}`);
          success++;
        } catch (err) {
          console.log(`  ❌ Failed: ${err.message}`);
        }
      })
      .on("end", () => {
        console.log("\n" + "=".repeat(40));
        console.log(`Total: ${count} rows`);
        console.log(`Success: ${success} files`);
        console.log(`Output: ${path.resolve(CONFIG.OUTPUT_DIR)}`);
        console.log("=".repeat(40));
        resolve({ total: count, success });
      })
      .on("error", reject);
  });
}

// Run
if (require.main === module) {
  processCSV()
    .then(() => console.log("\n🎉 Done!"))
    .catch((err) => {
      console.error("\n💥 Error:", err.message);
      process.exit(1);
    });
}

module.exports = { processCSV };
