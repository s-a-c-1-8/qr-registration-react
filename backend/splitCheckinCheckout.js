const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

async function splitCSV(filePath) {
  return new Promise((resolve, reject) => {
    const checkInMap = new Map(); // email -> row
    const checkOutMap = new Map(); // email -> row

    let totalRows = 0;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        totalRows++;

        const email = row.email?.trim().toLowerCase();
        if (!email) return;

        const baseData = {
          id: row.id,
          name: row.name,
          email,
          uniqueId: row.uniqueId,
        };

        // ✅ Check-in: isEntered === true
        if (row.isEntered === "true" || row.isEntered === true) {
          if (!checkInMap.has(email)) {
            checkInMap.set(email, baseData);
          }
        }

        // ✅ Check-out: isEntered === true && isHuddy === true
        if (
          (row.isEntered === "true" || row.isEntered === true) &&
          (row.isHuddy === "true" || row.isHuddy === true)
        ) {
          if (!checkOutMap.has(email)) {
            checkOutMap.set(email, baseData);
          }
        }
      })
      .on("end", () => {
        const dir = path.dirname(filePath);
        const base = path.basename(filePath, ".csv");

        const checkInFile = path.join(dir, `${base}_checkin.csv`);
        const checkOutFile = path.join(dir, `${base}_checkout.csv`);

        writeCSV(checkInFile, checkInMap);
        writeCSV(checkOutFile, checkOutMap);

        console.log("\n====== CSV REPORT ======");
        console.log(`Total rows processed: ${totalRows}`);

        console.log("\n--- CHECK-IN (isEntered = true) ---");
        console.log(`Unique records: ${checkInMap.size}`);

        console.log("\n--- CHECK-OUT (isEntered = true & isHuddy = true) ---");
        console.log(`Unique records: ${checkOutMap.size}`);

        console.log("\nFiles created:");
        console.log(checkInFile);
        console.log(checkOutFile);

        resolve();
      })
      .on("error", reject);
  });
}

function writeCSV(filePath, dataMap) {
  const header = "id,name,email,uniqueId\n";
  const rows = Array.from(dataMap.values())
    .map((r) => `${r.id},${r.name},${r.email},${r.uniqueId}`)
    .join("\n");

  fs.writeFileSync(filePath, header + rows);
}

// ---------- RUN ----------
const inputFile = process.argv[2] || "./users.csv";

if (!fs.existsSync(inputFile)) {
  console.error("CSV file not found:", inputFile);
  process.exit(1);
}

splitCSV(inputFile)
  .then(() => console.log("\n✅ Done"))
  .catch((err) => console.error("❌ Error:", err.message));
