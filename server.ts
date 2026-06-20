import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middlewares to parse request bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Custom API or health check placeholder if needed
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API endpoint to dispatch self-registration notification email
  app.post("/api/send-registration-email", async (req, res) => {
    try {
      const { username, name, email, contact } = req.body;

      if (!username || !name || !email || !contact) {
        return res.status(400).json({ error: "Missing required agent registration details" });
      }

      const subject = `⚠️ ACTION REQUIRED: New Field Agent Registration [${username}]`;
      const emailHtml = `
        <div style="font-family: sans-serif; padding: 20px; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; border-bottom: 2px solid #0F6E56; padding-bottom: 15px; margin-bottom: 20px;">
            <h2 style="color: #0F6E56; margin: 0;">CallMe Tag Agent Network</h2>
            <p style="color: #64748b; font-size: 14px; margin: 5px 0 0 0;">New Field Partner Self-Registration Notification</p>
          </div>
          
          <p style="font-size: 15px; color: #1e293b; line-height: 1.5;">
            A new on-site agent has submitted a partner registration request. Review their registry details and choose to activate or reject them inside your Admin Panel.
          </p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
            <tr style="background-color: #f8fafc;">
              <th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Agent ID (Username)</th>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #0F6E56;">${username}</td>
            </tr>
            <tr>
              <th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Full Name / Agency Name</th>
              <td style="padding: 10px; border: 1px solid #e2e8f0; color: #1e293b;">${name}</td>
            </tr>
            <tr style="background-color: #f8fafc;">
              <th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Email Address</th>
              <td style="padding: 10px; border: 1px solid #e2e8f0; color: #1e293b;"><a href="mailto:${email}" style="color: #0F6E56; text-decoration: none;">${email}</a></td>
            </tr>
            <tr>
              <th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Mobile Number</th>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace; color: #1e293b;">${contact}</td>
            </tr>
            <tr style="background-color: #f8fafc;">
              <th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Date Submitted</th>
              <td style="padding: 10px; border: 1px solid #e2e8f0; color: #1e293b;">${new Date().toLocaleString()}</td>
            </tr>
          </table>

          <div style="background-color: #fffbeb; border: 1px solid #fef3c7; color: #b45309; padding: 12px; border-radius: 8px; font-size: 13px; margin-bottom: 20px;">
            <strong>How to Activate:</strong> Go to the <a href="${req.headers.origin || 'https://ai.studio/build'}" style="color: #0F6E56; font-weight: bold; text-decoration: underline;">CallMe Tag Admin Panel</a>, sign in using your Super Admin or Supervisor credentials, head to the <strong>"Agents"</strong> or <strong>"Resellers"</strong> tab, find <strong>${username}</strong> and click <strong>"Approve / Activate"</strong>.
          </div>

          <div style="text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 15px; margin-top: 20px;">
            Dubai QR Contact Management System Security Workspace • Automated dispatch
          </div>
        </div>
      `;

      let emailUserRaw = process.env.EMAIL_USER;
      let emailPassRaw = process.env.EMAIL_PASS;
      const emailHost = process.env.EMAIL_HOST || "smtp.gmail.com";
      const emailPort = parseInt(process.env.EMAIL_PORT || "465", 10);
      const adminEmail = (process.env.ADMIN_NOTIFICATION_EMAIL || "ashikr583@gmail.com").replace(/['"\s]/g, "").trim();

      // Implement robust defaults and trim/clean all spaces or accidental quotes
      if (!emailUserRaw || emailUserRaw.trim() === "" || emailUserRaw === "MY_EMAIL_USER") {
        emailUserRaw = "ashikr583@gmail.com";
      }
      if (!emailPassRaw || emailPassRaw.trim() === "" || emailPassRaw === "MY_EMAIL_PASS") {
        emailPassRaw = "turraqycvbybotur";
      }

      const emailUser = emailUserRaw.replace(/['"\s]/g, "").trim();
      const emailPass = emailPassRaw.replace(/['"\s]/g, "").trim();

      console.log("\n========================================================");
      console.log(`📧 INBOUND REGISTRATION NOTIFICATION TO ADMIN (${adminEmail})`);
      console.log(`Using Sender Email: ${emailUser}`);
      console.log(`Password character count: ${emailPass.length}`);
      console.log(`Agent ID: ${username}`);
      console.log(`Name    : ${name}`);
      console.log(`Email   : ${email}`);
      console.log(`Mobile  : ${contact}`);
      console.log("========================================================\n");

      if (!emailUser || !emailPass) {
        console.log("⚠️ EMAIL NOT SENT TO SMTP: EMAIL_USER or EMAIL_PASS environment variables are missing.");
        console.log("Registering partner safely in local system. To trigger real SMTP notifications, configure secrets in your app settings.");
        return res.json({
          success: true,
          detailsLogged: true,
          msg: "Log notification printed to system workspace. Define EMAIL_USER, EMAIL_PASS, and optionally ADMIN_NOTIFICATION_EMAIL to trigger real SMTP deliveries."
        });
      }

      const transporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort,
        secure: emailPort === 465,
        auth: {
          user: emailUser,
          pass: emailPass
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      await transporter.sendMail({
        from: `"CallMe Tag Registry" <${emailUser}>`,
        to: adminEmail,
        subject,
        html: emailHtml
      });

      console.log(`✅ Success: Verification email dispatched successfully to ${adminEmail}`);
      res.json({ success: true, sent: true });
    } catch (err: any) {
      console.error("❌ Nodemailer dispatch error:", err);
      // Soft fall-through so registration doesn't crash if SMTP fails
      res.json({
        success: true,
        sent: false,
        warning: "Database registered successfully, but email dispatch failed.",
        error: err.message
      });
    }
  });

  // Vite middleware for development or fallback static folder in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
