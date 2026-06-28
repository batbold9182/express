import nodemailer from 'nodemailer';

export async function sendPasswordReset(toEmail: string, resetToken: string) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
  const frontendBase = process.env.FRONTEND_WEB_BASE ?? 'http://localhost:5173';
  const resetUrl = `${frontendBase}/reset-password?token=${resetToken}&email=${encodeURIComponent(toEmail)}`;

  await transporter.sendMail({
    from: `"Tunelog" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'Reset your Tunelog password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0B0816;color:#E6E2F2;border-radius:16px;">
        <h1 style="font-size:28px;font-weight:bold;background:linear-gradient(90deg,#00D9FF,#B14EFF,#FF3FA4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:0 0 8px;">tunelog</h1>
        <p style="color:#8A7FAC;margin:0 0 24px;">Rate music. Build your taste.</p>
        <p style="margin:0 0 24px;">Click the button below to reset your password. This link expires in <strong>15 minutes</strong>.</p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:14px 28px;background:linear-gradient(90deg,#B14EFF,#FF3FA4);color:#fff;font-weight:bold;text-decoration:none;border-radius:12px;">
          Reset Password
        </a>
        <p style="margin:24px 0 0;color:#5A4F78;font-size:12px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
