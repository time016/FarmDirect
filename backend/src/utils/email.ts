import nodemailer from 'nodemailer'

const BRAND = '#16a34a'
const BRAND_DARK = '#15803d'
const CLIENT_URL = () => process.env.CLIENT_URL || 'http://localhost:3000'

function createTransporter() {
  if (!process.env.SMTP_HOST) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    family: 4, // force IPv4 — Railway does not support IPv6 outbound
  })
}

// ─── Icon map for notification types ─────────────────────────────────────────
const TYPE_META: Record<string, { icon: string; color: string; label: string }> = {
  ORDER_PLACED:    { icon: '🛒', color: '#2563eb', label: 'ออเดอร์ใหม่' },
  ORDER_CONFIRMED: { icon: '✅', color: '#7c3aed', label: 'ยืนยันออเดอร์' },
  ORDER_SHIPPING:  { icon: '🚚', color: '#d97706', label: 'กำลังจัดส่ง' },
  ORDER_DELIVERED: { icon: '#16a34a', color: '#16a34a', label: 'จัดส่งสำเร็จ' },
  ORDER_CANCELLED: { icon: '❌', color: '#dc2626', label: 'ยกเลิกออเดอร์' },
  DEFAULT:         { icon: '🔔', color: BRAND, label: 'แจ้งเตือน' },
}

function getMeta(type?: string) {
  if (!type) return TYPE_META.DEFAULT
  return TYPE_META[type] ?? TYPE_META.DEFAULT
}

// ─── Base layout ──────────────────────────────────────────────────────────────
function layout(inner: string) {
  return `<!DOCTYPE html>
<html lang="th">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,${BRAND} 0%,${BRAND_DARK} 100%);padding:28px 32px">
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">🌾 FarmDirect</p>
            <p style="margin:4px 0 0;font-size:13px;color:#bbf7d0">สินค้าเกษตรจากฟาร์มสู่มือคุณ</p>
          </td>
        </tr>
        <!-- Body -->
        ${inner}
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6">
              อีเมลนี้ถูกส่งอัตโนมัติจากระบบ FarmDirect · กรุณาอย่าตอบกลับ<br>
              © ${new Date().getFullYear()} FarmDirect. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── Notification email template ──────────────────────────────────────────────
function notificationTemplate(title: string, body: string, link?: string, type?: string) {
  const meta = getMeta(type)
  const btn = link
    ? `<table cellpadding="0" cellspacing="0" style="margin-top:24px">
        <tr><td style="background:${BRAND};border-radius:8px">
          <a href="${CLIENT_URL()}${link}"
             style="display:inline-block;padding:13px 28px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;border-radius:8px">
            ดูรายละเอียดออเดอร์ →
          </a>
        </td></tr>
      </table>`
    : ''

  const inner = `
    <tr>
      <td style="padding:32px 32px 8px">
        <!-- Badge -->
        <span style="display:inline-block;background:${meta.color}1a;color:${meta.color};font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px;margin-bottom:16px">
          ${meta.icon}&nbsp;&nbsp;${meta.label}
        </span>
        <!-- Title -->
        <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827;line-height:1.3">${title}</h2>
        <!-- Divider -->
        <div style="height:3px;width:48px;background:${BRAND};border-radius:2px;margin-bottom:20px"></div>
        <!-- Body -->
        <p style="margin:0;font-size:15px;color:#374151;line-height:1.7">${body}</p>
        ${btn}
      </td>
    </tr>
    <tr><td style="height:32px"></td></tr>
  `
  return layout(inner)
}

// ─── Verification / Reset email template ─────────────────────────────────────
function verificationTemplate(title: string, code: string, expiry: string) {
  const inner = `
    <tr>
      <td style="padding:32px 32px 8px">
        <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827">${title}</h2>
        <div style="height:3px;width:48px;background:${BRAND};border-radius:2px;margin-bottom:20px"></div>
        <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7">รหัสยืนยันของคุณคือ:</p>
        <!-- Code box -->
        <div style="background:#f0fdf4;border:2px dashed ${BRAND};border-radius:12px;padding:20px;text-align:center;margin-bottom:20px">
          <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:${BRAND};font-family:monospace">${code}</span>
        </div>
        <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6">
          รหัสนี้มีอายุ <strong>${expiry}</strong><br>
          หากคุณไม่ได้ร้องขอ กรุณาเพิกเฉยต่ออีเมลนี้
        </p>
      </td>
    </tr>
    <tr><td style="height:32px"></td></tr>
  `
  return layout(inner)
}

// ─── Public functions ─────────────────────────────────────────────────────────
export async function sendNotificationEmail(
  to: string,
  subject: string,
  title: string,
  body: string,
  link?: string,
  type?: string,
) {
  const transporter = createTransporter()
  if (!transporter) {
    console.log(`[DEV EMAIL] to=${to} subject="${subject}" body="${body}"`)
    return
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `[FarmDirect] ${subject}`,
    html: notificationTemplate(title, body, link, type),
  }).catch((err) => console.error('[EMAIL ERROR]', err.message))
}

export async function sendVerificationEmail(email: string, code: string, type: 'verify' | 'reset' = 'verify') {
  if (email.endsWith('@farmdirect.local')) return
  const isReset = type === 'reset'
  const subject = isReset ? 'รีเซ็ตรหัสผ่าน FarmDirect' : 'ยืนยันอีเมล FarmDirect'
  const title = isReset ? 'รีเซ็ตรหัสผ่านของคุณ' : 'ยืนยันอีเมลของคุณ'
  const expiry = isReset ? '15 นาที' : '10 นาที'

  const transporter = createTransporter()
  if (!transporter) {
    console.log(`[DEV] ${type} code for ${email}: ${code}`)
    return
  }
  console.log(`[EMAIL] sending ${type} to ${email}`)
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    html: verificationTemplate(title, code, expiry),
  }).then(() => console.log(`[EMAIL] sent ok → ${email}`))
    .catch((err) => console.error(`[EMAIL ERROR] ${type} to ${email}:`, err.message))
}
