// Mailjet email service integration

const MAILJET_API_URL = "https://api.mailjet.com/v3.1/send";

interface MailjetConfig {
  apiKey: string;
  secretKey: string;
  fromEmail: string;
  fromName: string;
}

function getMailjetConfig(): MailjetConfig | null {
  const apiKey = process.env.MAILJET_API_KEY;
  const secretKey = process.env.MAILJET_SECRET_KEY;
  const fromEmail = process.env.MAILJET_FROM_EMAIL;
  const fromName = process.env.MAILJET_FROM_NAME || "Qualitative";

  if (!apiKey || !secretKey || !fromEmail) {
    return null;
  }

  return { apiKey, secretKey, fromEmail, fromName };
}

export function isMailjetConfigured(): boolean {
  const configured = !!getMailjetConfig();
  if (!configured) {
    console.log("[Mailjet] Not configured - missing MAILJET_API_KEY, MAILJET_SECRET_KEY, or MAILJET_FROM_EMAIL");
  }
  return configured;
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

interface MailjetMessage {
  From: { Email: string; Name: string };
  To: Array<{ Email: string; Name?: string }>;
  Subject: string;
  TextPart?: string;
  HTMLPart?: string;
  ReplyTo?: { Email: string };
}

/**
 * Send an email via Mailjet
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log(`[Mailjet] Attempting to send email to: ${Array.isArray(options.to) ? options.to.join(", ") : options.to}`);
  console.log(`[Mailjet] Subject: ${options.subject}`);

  const config = getMailjetConfig();

  if (!config) {
    console.log("[Mailjet] Config not found - cannot send email");
    return {
      success: false,
      error: "Mailjet is not configured. Set MAILJET_API_KEY, MAILJET_SECRET_KEY, and MAILJET_FROM_EMAIL environment variables.",
    };
  }

  console.log(`[Mailjet] Config found - sending from: ${config.fromEmail}`);

  const { to, subject, text, html, replyTo } = options;

  // Build recipients array
  const recipients = Array.isArray(to)
    ? to.map((email) => ({ Email: email }))
    : [{ Email: to }];

  const message: MailjetMessage = {
    From: { Email: config.fromEmail, Name: config.fromName },
    To: recipients,
    Subject: subject,
  };

  if (text) {
    message.TextPart = text;
  }
  if (html) {
    message.HTMLPart = html;
  }
  if (replyTo) {
    message.ReplyTo = { Email: replyTo };
  }

  try {
    const response = await fetch(MAILJET_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.secretKey}`).toString("base64")}`,
      },
      body: JSON.stringify({ Messages: [message] }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Mailjet] API error:", response.status, errorText);
      return {
        success: false,
        error: `Mailjet error (${response.status}): ${errorText}`,
      };
    }

    const data = await response.json();
    console.log("[Mailjet] Response data:", JSON.stringify(data, null, 2));
    const messageResult = data.Messages?.[0];

    if (messageResult?.Status === "error") {
      console.error("[Mailjet] Message error:", messageResult.Errors);
      return {
        success: false,
        error: messageResult.Errors?.[0]?.ErrorMessage || "Unknown Mailjet error",
      };
    }

    console.log(`[Mailjet] Email sent successfully. MessageID: ${messageResult?.To?.[0]?.MessageID}`);
    return {
      success: true,
      messageId: messageResult?.To?.[0]?.MessageID?.toString(),
    };
  } catch (error) {
    console.error("Error sending email via Mailjet:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error sending email",
    };
  }
}

/**
 * Send a plain text email
 */
export async function sendTextEmail(
  to: string | string[],
  subject: string,
  body: string,
  replyTo?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendEmail({ to, subject, text: body, replyTo });
}

/**
 * Send an HTML email
 */
export async function sendHtmlEmail(
  to: string | string[],
  subject: string,
  html: string,
  replyTo?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendEmail({ to, subject, html, replyTo });
}
