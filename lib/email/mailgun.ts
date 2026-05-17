// Mailgun email service integration

const MAILGUN_API_URL = "https://api.mailgun.net/v3";

interface MailgunConfig {
  apiKey: string;
  domain: string;
  fromEmail: string;
  fromName: string;
}

function getMailgunConfig(): MailgunConfig | null {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const fromEmail = process.env.MAILGUN_FROM_EMAIL || `noreply@${domain}`;
  const fromName = process.env.MAILGUN_FROM_NAME || "Qualitative";

  if (!apiKey || !domain) {
    return null;
  }

  return { apiKey, domain, fromEmail, fromName };
}

export function isMailgunConfigured(): boolean {
  return !!getMailgunConfig();
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

interface MailgunResponse {
  id: string;
  message: string;
}

/**
 * Send an email via Mailgun
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = getMailgunConfig();

  if (!config) {
    return {
      success: false,
      error: "Mailgun is not configured. Set MAILGUN_API_KEY and MAILGUN_DOMAIN environment variables.",
    };
  }

  const { to, subject, text, html, replyTo } = options;

  // Build form data
  const formData = new FormData();
  formData.append("from", `${config.fromName} <${config.fromEmail}>`);
  formData.append("to", Array.isArray(to) ? to.join(",") : to);
  formData.append("subject", subject);

  if (text) {
    formData.append("text", text);
  }
  if (html) {
    formData.append("html", html);
  }
  if (replyTo) {
    formData.append("h:Reply-To", replyTo);
  }

  try {
    const response = await fetch(`${MAILGUN_API_URL}/${config.domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${config.apiKey}`).toString("base64")}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Mailgun API error:", errorText);
      return {
        success: false,
        error: `Mailgun error (${response.status}): ${errorText}`,
      };
    }

    const data: MailgunResponse = await response.json();
    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    console.error("Error sending email via Mailgun:", error);
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
