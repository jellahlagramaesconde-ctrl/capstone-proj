import dotenv from "dotenv";
dotenv.config();

/**
 * Normalizes phone numbers to standard format (e.g. +639XXXXXXXXX for Philippines)
 */
export function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, "").trim();

  // Handle Philippine standard format
  if (cleaned.startsWith("09") && cleaned.length === 11) {
    return "+63" + cleaned.slice(1);
  }
  if (cleaned.startsWith("9") && cleaned.length === 10) {
    return "+63" + cleaned;
  }
  if (cleaned.startsWith("639") && cleaned.length === 12) {
    return "+" + cleaned;
  }
  if (!cleaned.startsWith("+") && cleaned.length >= 10) {
    return "+" + cleaned;
  }
  return cleaned;
}

/**
 * Masks a phone number for UI privacy (e.g. "+63 9•• ••• •890")
 */
export function maskPhoneNumber(phone: string): string {
  const norm = normalizePhoneNumber(phone);
  if (norm.length <= 6) return norm;
  const start = norm.slice(0, 5); // "+63 9" or prefix
  const end = norm.slice(-3);     // last 3 digits
  return `${start}•• ••• •${end}`;
}

/**
 * Core SMS sender — dispatches via Semaphore HTTP API or logs to server terminal in Console/Sandbox mode.
 */
export async function sendSmsMessage(toPhone: string, message: string, tag: string = "SMS"): Promise<{ success: boolean; mode: string }> {
  const normalized = normalizePhoneNumber(toPhone);
  const smsProvider = (process.env.SMS_PROVIDER || "console").toLowerCase();
  const semaphoreApiKey = process.env.SEMAPHORE_API_KEY;

  console.log(`\n======================================================`);
  console.log(`📱 [${tag.toUpperCase()}]`);
  console.log(`To:        ${normalized}`);
  console.log(`Message:   ${message}`);
  console.log(`Mode:      ${smsProvider.toUpperCase()}`);
  console.log(`Timestamp: ${new Date().toLocaleTimeString()}`);
  console.log(`======================================================\n`);

  // If Semaphore SMS is configured and enabled
  if (smsProvider === "semaphore" && semaphoreApiKey) {
    const semPhone = normalized.startsWith("+") ? normalized.slice(1) : normalized;
    const payload: Record<string, any> = {
      apikey: semaphoreApiKey,
      number: semPhone,
      message,
    };
    if (process.env.SEMAPHORE_SENDER_NAME && process.env.SEMAPHORE_SENDER_NAME.trim()) {
      payload.sendername = process.env.SEMAPHORE_SENDER_NAME.trim();
    }
    const res = await fetch("https://api.semaphore.co/api/v4/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Semaphore SMS dispatch failed (${res.status}): ${errText}`);
    }
    return { success: true, mode: "semaphore" };
  }

  // Fallback: If Semaphore key is missing or SMS_PROVIDER=console, simulate via console log
  return { success: true, mode: "console" };
}

/**
 * Dispatches a 6-digit OTP code to the recipient's mobile phone number.
 */
export async function sendOtpSms(toPhone: string, otpCode: string): Promise<{ success: boolean; mode: string }> {
  const message = `[JORS COSCA] Your verification code is ${otpCode}. Valid for 15 minutes. Do not share this code.`;
  return await sendSmsMessage(toPhone, message, "SMS OTP DISPATCH");
}

export interface DispatchSmsDetails {
  ticketId: string;
  office: string;
  jobType: string;
  description: string;
  isEmergency: boolean;
  estimatedCost?: number;
}

/**
 * Dispatches a task assignment SMS notification to a technician/staff member.
 */
export async function sendTaskDispatchSms(toPhone: string, staffName: string, details: DispatchSmsDetails): Promise<void> {
  const { ticketId, office, jobType, description, isEmergency, estimatedCost } = details;
  const costPart = estimatedCost !== undefined ? ` Est: ₱${estimatedCost.toLocaleString()}.` : "";
  const emergencyPrefix = isEmergency ? "🚨 [EMERGENCY DISPATCH] " : "[JOB ORDER DISPATCH] ";

  const shortDesc = description.length > 70 ? description.slice(0, 67) + "..." : description;
  const message = `${emergencyPrefix}Hi ${staffName}, Ticket ${ticketId} assigned to you (${office} - ${jobType}). ${shortDesc}${costPart} Please log in to start.`;

  await sendSmsMessage(toPhone, message, "STAFF DISPATCH SMS");
}

/**
 * Dispatches a general status or approval notification SMS to an administrator, school head, or department user.
 */
export async function sendGenericNotificationSms(toPhone: string, subject: string, message: string, ticketId?: string): Promise<void> {
  const prefix = ticketId ? `[JORS COSCA - ${ticketId}] ` : `[JORS COSCA] `;
  const smsText = `${prefix}${subject}: ${message}`;
  await sendSmsMessage(toPhone, smsText, "STATUS NOTIFICATION SMS");
}

/**
 * Dispatches an emergency SMS alert for high-priority/hazard tickets directly to Admin or Maintenance Staff.
 */
export async function sendEmergencyAlertSms(
  toPhone: string,
  recipientName: string,
  ticketId: string,
  office: string,
  jobType: string,
  description: string,
  targetType: "ADMIN" | "STAFF" = "ADMIN"
): Promise<void> {
  const shortDesc = description.length > 60 ? description.slice(0, 57) + "..." : description;
  const message = targetType === "ADMIN"
    ? `🚨 [EMERGENCY ALERT] Ticket ${ticketId} (${office} - ${jobType}): "${shortDesc}". Immediate PPO review required!`
    : `🚨 [EMERGENCY DISPATCH] Hi ${recipientName}, urgent ticket ${ticketId} (${office} - ${jobType}): "${shortDesc}". Immediate response needed!`;

  await sendSmsMessage(toPhone, message, targetType === "ADMIN" ? "ADMIN EMERGENCY SMS" : "STAFF EMERGENCY SMS");
}

/**
 * Dispatches a standard new ticket request notification SMS.
 */
export async function sendTicketRequestNoticeSms(
  toPhone: string,
  recipientName: string,
  ticketId: string,
  office: string,
  jobType: string,
  description: string,
  targetType: "ADMIN" | "STAFF" = "ADMIN"
): Promise<void> {
  const shortDesc = description.length > 65 ? description.slice(0, 62) + "..." : description;
  const message = targetType === "ADMIN"
    ? `[JORS COSCA] New ticket ${ticketId} submitted by ${office} (${jobType}): "${shortDesc}". Awaiting PPO review.`
    : `[JOB ORDER ASSIGNED] Hi ${recipientName}, ticket ${ticketId} (${office} - ${jobType}) has been logged and assigned to you: "${shortDesc}".`;

  await sendSmsMessage(toPhone, message, targetType === "ADMIN" ? "ADMIN TICKET NOTICE" : "STAFF TICKET NOTICE");
}

