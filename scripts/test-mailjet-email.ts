/**
 * Script to test Mailjet email sending.
 * Run with: npx tsx scripts/test-mailjet-email.ts
 */
import { config } from "dotenv";

// Load environment variables from .env.local
config({ path: ".env.local" });

const MAILJET_API_URL = "https://api.mailjet.com/v3.1/send";

async function sendTestEmail(): Promise<void> {
  const apiKey = process.env.MAILJET_API_KEY;
  const secretKey = process.env.MAILJET_SECRET_KEY;
  const fromEmail = process.env.MAILJET_FROM_EMAIL;
  const fromName = process.env.MAILJET_FROM_NAME || "Qualitative";

  console.log("Mailjet Configuration:");
  console.log("─".repeat(50));
  console.log(`  API Key: ${apiKey ? apiKey.substring(0, 8) + "..." : "NOT SET"}`);
  console.log(`  Secret Key: ${secretKey ? secretKey.substring(0, 8) + "..." : "NOT SET"}`);
  console.log(`  From Email: ${fromEmail || "NOT SET"}`);
  console.log(`  From Name: ${fromName}`);
  console.log("─".repeat(50));

  if (!apiKey || !secretKey || !fromEmail) {
    console.error("\nERROR: Missing required Mailjet configuration!");
    console.error("Make sure MAILJET_API_KEY, MAILJET_SECRET_KEY, and MAILJET_FROM_EMAIL are set.");
    return;
  }

  // Send to the same address as from (for testing)
  const toEmail = fromEmail;

  console.log(`\nSending test email to: ${toEmail}`);

  const message = {
    From: { Email: fromEmail, Name: fromName },
    To: [{ Email: toEmail }],
    Subject: "Qualitative - Mailjet Test Email",
    TextPart: `This is a test email from Qualitative to verify Mailjet is working correctly.\n\nSent at: ${new Date().toISOString()}`,
    HTMLPart: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">Mailjet Test Email</h1>
        </div>
        <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <p>This is a test email from <strong>Qualitative</strong> to verify Mailjet is working correctly.</p>
          <p style="color: #6b7280; font-size: 14px;">Sent at: ${new Date().toISOString()}</p>
        </div>
      </div>
    `,
  };

  try {
    const response = await fetch(MAILJET_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString("base64")}`,
      },
      body: JSON.stringify({ Messages: [message] }),
    });

    const data = await response.json();

    console.log(`\nResponse status: ${response.status}`);
    console.log("Response data:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error("\nERROR: Mailjet API returned an error!");
      return;
    }

    const messageResult = data.Messages?.[0];
    if (messageResult?.Status === "success") {
      console.log("\n✓ SUCCESS! Test email sent successfully.");
      console.log(`  Message ID: ${messageResult.To?.[0]?.MessageID}`);
      console.log(`  Check ${toEmail} inbox (and spam folder) for the test email.`);
    } else {
      console.error("\nERROR: Message sending failed!");
      console.error("Errors:", messageResult?.Errors);
    }
  } catch (error) {
    console.error("\nERROR: Failed to send email:", error);
  }
}

sendTestEmail();
