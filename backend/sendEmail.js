// sendEmail.js - QR Email with Supabase Upload & URL in Email Body
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const QRCode = require("qrcode");
const sharp = require("sharp");
const { Resend } = require("resend");
const { createClient } = require("@supabase/supabase-js");

// Configuration
const CONFIG = {
  INPUT_CSV: "./userdata.csv",
  TEMPLATE_IMAGE: "./bg.jpeg",
  OUTPUT_DIR: "./output",
  QR_CODE_SIZE: 250,
  QR_POSITION_X: 225,
  QR_POSITION_Y: 940,

  // Email Configuration
  EMAIL_FROM: "Autodesk Annual Day 2025 <autodeskannualday2025@eventnotify.in>",
  EMAIL_SUBJECT: "Autodesk Annual Day 2025 Invite",

  // Resend API Key
  RESEND_API_KEY: "re_R5sBq4Kj_5skaMbsvkbapjcZ1vJvEweRe",

  // Supabase Configuration
  SUPABASE_URL: "https://gxfqhxtrellgujqgcmve.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4ZnFoeHRyZWxsZ3VqcWdjbXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUyMTU2NzMsImV4cCI6MjA2MDc5MTY3M30.xLzBCmeRw1VpR9olYC3QyzDY83Vpdc3husbORA17BYY", // Add your Supabase anon/public key
  SUPABASE_BUCKET: "autodesk", // Your bucket name

  // Test mode
  TEST_MODE: false,
};

// Initialize Resend
const resend = CONFIG.RESEND_API_KEY ? new Resend(CONFIG.RESEND_API_KEY) : null;

// Initialize Supabase
const supabase = CONFIG.SUPABASE_ANON_KEY
  ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY)
  : null;

const stats = {
  total: 0,
  sent: 0,
  failed: 0,
  failures: [],
  uploadedImages: [],
};

async function generateAndSaveQRImage(code) {
  console.log(`   🔳 Generating QR code...`);

  // Generate QR code
  const qrBuffer = await QRCode.toBuffer(code, {
    width: CONFIG.QR_CODE_SIZE,
    margin: 1,
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  console.log(`   🖼️  Merging with background...`);

  // Merge with background
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

  // Save file to output folder (optional, for backup)
  const outputPath = path.join(CONFIG.OUTPUT_DIR, `${code}.png`);
  console.log(`   💾 Saving locally: ${outputPath}`);
  await fs.promises.writeFile(outputPath, mergedImage);

  return {
    path: outputPath,
    buffer: mergedImage,
    filename: `${code}.png`,
  };
}

async function uploadToSupabase(code, imageBuffer) {
  try {
    console.log(`   ☁️  Uploading to Supabase...`);

    if (!supabase) {
      throw new Error("Supabase client not initialized. Check API key.");
    }

    const fileName = `${code}.png`;
    const filePath = `tickets/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(CONFIG.SUPABASE_BUCKET)
      .upload(filePath, imageBuffer, {
        contentType: "image/png",
        upsert: true, // Replace if file exists
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(CONFIG.SUPABASE_BUCKET).getPublicUrl(filePath);

    console.log(`   ✅ Uploaded! URL: ${publicUrl}`);

    return {
      success: true,
      publicUrl: publicUrl,
      fileName: fileName,
      filePath: filePath,
    };
  } catch (error) {
    console.log(`   ❌ Upload failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function sendEmailWithSupabaseURL(email, name, code, supabaseUrl) {
  try {
    console.log(`📧 Preparing email for: ${email}`);

    if (CONFIG.TEST_MODE) {
      console.log(`   🧪 TEST MODE: Would send email to ${email}`);
      console.log(`   🌐 Using Supabase URL: ${supabaseUrl}`);
      stats.sent++;
      return { success: true, emailId: "test-mode" };
    }

    if (!resend) {
      throw new Error("Resend not initialized. Check API key.");
    }

    // Create email with Supabase URL in body
    const emailData = {
      from: CONFIG.EMAIL_FROM,
      to: email,
      subject: CONFIG.EMAIL_SUBJECT,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body, html {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background-color: #f0f0f0;
      font-family: Arial, sans-serif;
    }
    .email-wrapper {
      width: 100%;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .ticket-container {
      text-align: center;
      max-width: 100%;
    }
    .ticket-image {
      max-width: 100%;
      height: auto;
      display: block;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      margin: 0 auto;
    }
    .ticket-info {
      margin-top: 20px;
      padding: 15px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      max-width: 500px;
    }
    .user-name {
      font-size: 20px;
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 8px;
    }
    .user-code {
      font-size: 18px;
      color: #3498db;
      font-family: monospace;
      background: #f8f9fa;
      padding: 8px 15px;
      border-radius: 5px;
      display: inline-block;
    }
    .instructions {
      margin-top: 15px;
      color: #666;
      font-size: 14px;
    }
    .fallback-url {
      margin-top: 15px;
      font-size: 14px;
      color: #c0392b;
      word-break: break-all;
    }
    .footer {
      margin-top: 25px;
      color: #888;
      font-size: 12px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="ticket-container">

      <!-- TICKET IMAGE FROM SUPABASE URL -->
      <img src="${supabaseUrl}" alt="Autodesk Annual Day Ticket" class="ticket-image" />

      <div class="ticket-info">
        <div class="user-name">Hi ${name}!</div>
        <div class="user-code">Ticket Code: ${code}</div>

        <div class="instructions">
          <p>📱 Present this QR code at the entrance</p>
          <p>🎟️ Your unique digital ticket</p>
          <p>📍 Venue: ITC Gardenia, Mysore Hall</p>
          <p>📅 Date: 12th December 2025 | ⏰ Time: 5:00 PM</p>
        </div>

        <!-- ✅ NEW MESSAGE WITH URL -->
        <div class="fallback-url" style="margin-top: 20px; text-align: center;">
  <p style="color: #555; font-size: 14px;">
    If the ticket image above doesn't load:
  </p>

  <a href="${supabaseUrl}" 
     style="
        display: inline-block;
        padding: 12px 22px;
        background-color: #007bff;
        color: white !important;
        text-decoration: none;
        border-radius: 6px;
        font-weight: bold;
        font-size: 15px;
        font-family: Arial, sans-serif;
        margin-top: 8px;
     "
     target="_blank">
    🔗 View Ticket
  </a>
</div>

      </div>

      <div class="footer">
        <p>Autodesk Annual Day 2025</p>
        <p>This is your digital ticket. Save this email or take a screenshot.</p>
      </div>
    </div>
  </div>
</body>
</html>`,
    };

    console.log(`   📤 Sending email with Supabase image URL...`);
    const response = await resend.emails.send(emailData);

    if (response.error) {
      throw new Error(JSON.stringify(response.error));
    }

    console.log(`   ✅ Email sent! ID: ${response.data?.id || "N/A"}`);
    stats.sent++;

    return {
      success: true,
      emailId: response.data?.id,
      supabaseUrl,
    };
  } catch (error) {
    const errorMsg = error.message || JSON.stringify(error);
    console.log(`   ❌ Failed: ${errorMsg}`);
    stats.failed++;
    stats.failures.push({ email, error: errorMsg });
    return { success: false, error: errorMsg };
  }
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processUser(user, index) {
  const name = (user.name || "").trim();
  const email = (user.email || "").trim().toLowerCase();
  const code = (user.code || "").trim();

  console.log(`\n${index + 1}. Processing ${name} (${code})`);

  // Validate
  if (!email || !validateEmail(email)) {
    console.log(`   ❌ Skipping: Invalid email "${email}"`);
    stats.failed++;
    stats.failures.push({ email, error: "Invalid email format" });
    return { success: false };
  }

  if (!code) {
    console.log(`   ❌ Skipping: No code provided`);
    stats.failed++;
    stats.failures.push({ email, error: "No code provided" });
    return { success: false };
  }

  try {
    // STEP 1: Generate and save QR image
    const qrData = await generateAndSaveQRImage(code);

    // STEP 2: Upload to Supabase
    console.log(`   ☁️  Uploading image to Supabase...`);
    const uploadResult = await uploadToSupabase(code, qrData.buffer);

    if (!uploadResult.success) {
      throw new Error(`Supabase upload failed: ${uploadResult.error}`);
    }

    // Save upload info
    stats.uploadedImages.push({
      code: code,
      name: name,
      url: uploadResult.publicUrl,
    });

    // Wait a moment
    await delay(500);

    // STEP 3: Send email with Supabase URL
    console.log(`   ✉️  Sending to: ${email}`);
    const result = await sendEmailWithSupabaseURL(
      email,
      name,
      code,
      uploadResult.publicUrl
    );

    if (result.success) {
      console.log(`   ✅ Email sent with Supabase image URL!`);
      return {
        success: true,
        name,
        email,
        code,
        supabaseUrl: uploadResult.publicUrl,
      };
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, name, email, code, error: error.message };
  }
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

async function main() {
  console.log("🚀 Starting Email Sender with Supabase Upload\n");

  // Check files
  if (!fs.existsSync(CONFIG.INPUT_CSV)) {
    console.error(`❌ CSV not found: ${CONFIG.INPUT_CSV}`);
    return;
  }
  if (!fs.existsSync(CONFIG.TEMPLATE_IMAGE)) {
    console.error(`❌ Background image not found: ${CONFIG.TEMPLATE_IMAGE}`);
    return;
  }

  // Create output directory
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
  }

  console.log("📋 Configuration:");
  console.log(`   CSV: ${CONFIG.INPUT_CSV}`);
  console.log(`   Template: ${CONFIG.TEMPLATE_IMAGE}`);
  console.log(`   Local Output: ${CONFIG.OUTPUT_DIR}`);
  console.log(`   Supabase Bucket: ${CONFIG.SUPABASE_BUCKET}`);
  console.log(`   From Email: ${CONFIG.EMAIL_FROM}`);
  console.log(`   Test Mode: ${CONFIG.TEST_MODE ? "YES" : "NO"}`);
  console.log("");

  // Check Supabase config
  if (
    !CONFIG.SUPABASE_ANON_KEY ||
    CONFIG.SUPABASE_ANON_KEY.includes("your-supabase-anon-key")
  ) {
    console.log(`   ⚠️  Supabase ANON KEY not configured!`);
    console.log(`   Get it from: Supabase Dashboard → Settings → API`);
    return;
  }

  if (!supabase) {
    console.log(`   ❌ Supabase client failed to initialize`);
    return;
  }

  // Read CSV with data cleaning
  const users = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(CONFIG.INPUT_CSV)
      .pipe(csv())
      .on("data", (row) => {
        const cleanRow = {};
        Object.keys(row).forEach((key) => {
          cleanRow[key] = (row[key] || "").toString().trim();
          if (key === "email") cleanRow[key] = cleanRow[key].toLowerCase();
        });
        users.push(cleanRow);
      })
      .on("end", resolve)
      .on("error", reject);
  });

  console.log(`📊 Found ${users.length} users\n`);
  stats.total = users.length;

  // Show user list
  console.log("👥 User List:");
  users.forEach((user, i) => {
    console.log(`   ${i + 1}. ${user.name} - ${user.email} - ${user.code}`);
  });
  console.log("");

  // Process users one by one
  for (let i = 0; i < users.length; i++) {
    await processUser(users[i], i);

    // Add delay between emails
    if (i < users.length - 1 && !CONFIG.TEST_MODE) {
      console.log(`   ⏳ Waiting 2 seconds before next...`);
      await delay(2000);
    }
  }

  // Show summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 PROCESS SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total Users: ${stats.total}`);
  console.log(`Images Uploaded: ${stats.uploadedImages.length}`);
  console.log(`Emails Sent: ${stats.sent}`);
  console.log(`Emails Failed: ${stats.failed}`);
  console.log(
    `Success Rate: ${
      stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0
    }%`
  );
  console.log("");

  // Show uploaded image URLs
  if (stats.uploadedImages.length > 0) {
    console.log("🌐 Uploaded Image URLs:");
    stats.uploadedImages.forEach((img, i) => {
      console.log(`   ${i + 1}. ${img.code} (${img.name}):`);
      console.log(`      ${img.url}`);
    });

    // Save URLs to file
    const urlsFile = path.join(CONFIG.OUTPUT_DIR, "_supabase_urls.csv");
    const urlsData = stats.uploadedImages
      .map((img) => `${img.code},${img.name},${img.url}`)
      .join("\n");
    fs.writeFileSync(urlsFile, `code,name,url\n${urlsData}`);
    console.log(`\n📄 URLs saved to: ${urlsFile}`);
  }

  if (stats.failed > 0) {
    console.log("\n❌ Failed:");
    stats.failures.forEach((fail, i) => {
      console.log(`   ${i + 1}. ${fail.email || "No email"}: ${fail.error}`);
    });

    const failFile = path.join(CONFIG.OUTPUT_DIR, "_failed_emails.csv");
    const failData = stats.failures
      .map((f) => `${f.email || ""},${f.error || ""}`)
      .join("\n");
    fs.writeFileSync(failFile, `email,error\n${failData}`);
    console.log(`\n📄 Failures saved to: ${failFile}`);
  }

  console.log(`\n📁 Local images saved in: ${path.resolve(CONFIG.OUTPUT_DIR)}`);

  if (CONFIG.TEST_MODE) {
    console.log("\n⚠️  TEST MODE - No emails were actually sent");
    console.log("   Generated images are saved locally");
    console.log("   Set TEST_MODE: false to send real emails");
  }

  console.log("=".repeat(60));
  console.log("\n✅ Process completed!");
}

// Install required package: npm install @supabase/supabase-js
if (require.main === module) {
  main().catch((error) => {
    console.error("\n💥 Fatal error:", error.message);
    process.exit(1);
  });
}

module.exports = { main };
