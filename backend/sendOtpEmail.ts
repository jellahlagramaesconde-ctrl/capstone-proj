import dotenv from "dotenv";
dotenv.config();

// Sends the password-reset OTP via Brevo's transactional email API.
//
// One-time setup:
//   1. Sign up free at https://www.brevo.com (no card needed)
//   2. Settings -> Senders, Domains & Dedicated IPs -> Senders -> Add a sender
//      using an email you control (e.g. your own Gmail). Click the
//      confirmation link Brevo emails you.
//   3. Settings -> SMTP & API -> API Keys -> Generate a new API key.
//   4. Add to your .env:
//        BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
//        BREVO_SENDER_EMAIL=you@gmail.com   (must match the verified sender)
//        BREVO_SENDER_NAME=JORS COSCA
//
// Free plan: 300 emails/day, forever, sends to any recipient once the
// sender above is verified.

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

// Shared low-level sender — both the OTP email and the task-dispatch email
// below go through this, so there's exactly one place that talks to Brevo.
async function sendBrevoEmail(toEmail: string, subject: string, htmlContent: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "JORS COSCA";

  if (!apiKey || !senderEmail) {
    throw new Error("Missing BREVO_API_KEY or BREVO_SENDER_EMAIL in .env");
  }

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: toEmail }],
      subject,
      htmlContent,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Brevo send failed (${res.status}): ${errBody}`);
  }
}

export async function sendOtpEmail(toEmail: string, otpCode: string): Promise<void> {
  await sendBrevoEmail(
    toEmail,
    "Your JORS COSCA password reset code",
    `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #6B1420;">Password Reset Request</h2>
        <p>Someone requested a password reset for the JORS COSCA account registered to this email.</p>
        <p>Your verification code is:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #241012;">
          ${otpCode}
        </p>
        <p>This code expires in 15 minutes. If you did not request this, you can safely ignore this email.</p>
      </div>
    `
  );
}

// Generic notification email — used for every other notification event
// (PPO, President, Finance, and Dept) that isn't the specific rich staff
// dispatch email above. Same "you have to log in to see full detail"
// pattern as the dispatch email, just without the ticket-detail fields
// that only make sense for a dispatch.
export async function sendGenericNotificationEmail(toEmail: string, subject: string, message: string, ticketId?: string): Promise<void> {
  await sendBrevoEmail(
    toEmail,
    subject,
    `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #6B1420;">JORS COSCA Notification</h2>
        <p>${message}</p>
        ${ticketId ? `<p><strong>Ticket ID:</strong> ${ticketId}</p>` : ""}
        <p>Please log in to JORS COSCA to view full details.</p>
      </div>
    `
  );
}
// Sent to a maintenance staff member's registered email the moment a job
// order is actually dispatched to them — either the emergency PPO-approval
// track (dispatched immediately) or the normal track (dispatched once
// Finance releases funding). Fulfills FR#6 / System Features 5.1's
// "assigned staff receive automated email notifications when tasks are
// dispatched" claim, which previously had no corresponding code.
export interface DispatchEmailDetails {
  ticketId: string;
  office: string;
  jobType: string;
  description: string;
  isEmergency: boolean;
  estimatedCost?: number;
}

export async function sendTaskDispatchEmail(toEmail: string, staffName: string, details: DispatchEmailDetails): Promise<void> {
  const { ticketId, office, jobType, description, isEmergency, estimatedCost } = details;
  const costLine = estimatedCost !== undefined
    ? `<p><strong>Estimated Cost:</strong> ₱${estimatedCost.toLocaleString()}</p>`
    : "";
  const emergencyBanner = isEmergency
    ? `<p style="background:#F5A623;color:#241012;font-weight:bold;padding:8px 12px;border-radius:6px;display:inline-block;">🚨 EMERGENCY DISPATCH — Immediate Action Required</p>`
    : "";

  await sendBrevoEmail(
    toEmail,
    isEmergency
      ? `🚨 EMERGENCY Job Order Dispatched — ${ticketId}`
      : `New Job Order Dispatched — ${ticketId}`,
    `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #6B1420;">Job Order Dispatched to You</h2>
        <p>Hi ${staffName},</p>
        ${emergencyBanner}
        <p>A job order has been assigned to you and is ready to start:</p>
        <p><strong>Ticket ID:</strong> ${ticketId}</p>
        <p><strong>Office:</strong> ${office}</p>
        <p><strong>Job Type:</strong> ${jobType}</p>
        <p><strong>Description:</strong> ${description}</p>
        ${costLine}
        <p>Please log in to JORS COSCA to view full details and update the status once you begin work.</p>
      </div>
    `
  );
}