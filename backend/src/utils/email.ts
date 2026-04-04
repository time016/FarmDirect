import nodemailer from 'nodemailer'

function createTransporter() {
  if (!process.env.SMTP_HOST) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendVerificationEmail(email: string, code: string, type: 'verify' | 'reset' = 'verify') {
  const isReset = type === 'reset'
  const subject = isReset ? 'รีเซ็ตรหัสผ่าน FarmDirect' : 'ยืนยันอีเมล FarmDirect'
  const title = isReset ? 'รีเซ็ตรหัสผ่านของคุณ' : 'ยืนยันอีเมลของคุณ'
  const expiry = isReset ? '15 นาที' : '10 นาที'

  const transporter = createTransporter()
  if (!transporter) {
    console.log(`[DEV] ${type} code for ${email}: ${code}`)
    return
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#16a34a">${title}</h2>
        <p>รหัสของคุณคือ:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#16a34a;padding:16px 0">${code}</div>
        <p style="color:#6b7280;font-size:14px">รหัสนี้มีอายุ ${expiry} หากคุณไม่ได้ร้องขอ กรุณาเพิกเฉยต่ออีเมลนี้</p>
      </div>
    `,
  })
}
