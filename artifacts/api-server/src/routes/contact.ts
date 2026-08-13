/**
 * POST /contact — public contact form endpoint.
 * Sends an email to CONTACT_TO (default tung@pamacorp.com) via SMTP.
 */
import nodemailer from 'nodemailer';
import { Router, type Request, type Response } from 'express';

const router = Router();

const CONTACT_TO = process.env.CONTACT_EMAIL_TO ?? 'tung@pamacorp.com';

function makeTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

router.post('/contact', async (req: Request, res: Response): Promise<void> => {
  const { name, email, phone, subject, message } = req.body as {
    name?: string; email?: string; phone?: string; subject?: string; message?: string;
  };

  // Basic validation
  if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
    res.status(400).json({ error: 'Vui lòng điền đầy đủ các trường bắt buộc.' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Địa chỉ email không hợp lệ.' });
    return;
  }
  if (message.trim().length < 10) {
    res.status(400).json({ error: 'Nội dung quá ngắn (tối thiểu 10 ký tự).' });
    return;
  }

  const transport = makeTransport();
  if (!transport) {
    // SMTP not configured — log and return a friendly error
    console.warn('[contact] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing)');
    res.status(503).json({
      error: 'Hệ thống gửi email chưa được cấu hình. Vui lòng liên hệ trực tiếp qua email.',
    });
    return;
  }

  const phoneInfo = phone?.trim() ? `\nĐiện thoại: ${phone.trim()}` : '';
  const htmlBody = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#8b1a1a;border-bottom:2px solid #8b1a1a;padding-bottom:8px">
    Liên hệ từ website ACVN
  </h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:6px 0;color:#555;width:130px"><strong>Họ tên:</strong></td><td>${escHtml(name)}</td></tr>
    <tr><td style="padding:6px 0;color:#555"><strong>Email:</strong></td><td><a href="mailto:${escHtml(email)}">${escHtml(email)}</a></td></tr>
    ${phone?.trim() ? `<tr><td style="padding:6px 0;color:#555"><strong>Điện thoại:</strong></td><td>${escHtml(phone)}</td></tr>` : ''}
    <tr><td style="padding:6px 0;color:#555"><strong>Tiêu đề:</strong></td><td>${escHtml(subject)}</td></tr>
  </table>
  <h3 style="margin-top:20px;color:#333">Nội dung:</h3>
  <div style="background:#f8f8f8;padding:16px;border-left:3px solid #8b1a1a;white-space:pre-wrap">${escHtml(message)}</div>
  <p style="font-size:12px;color:#999;margin-top:24px">
    Email này được gửi từ trang web Hội người Séc gốc Việt Nam (ACVN).
  </p>
</div>`;

  try {
    await transport.sendMail({
      from: `"ACVN Website" <${process.env.SMTP_USER}>`,
      replyTo: `"${name}" <${email}>`,
      to: CONTACT_TO,
      subject: `[ACVN Liên hệ] ${subject}`,
      text: `Họ tên: ${name}\nEmail: ${email}${phoneInfo}\nTiêu đề: ${subject}\n\nNội dung:\n${message}`,
      html: htmlBody,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[contact] sendMail error:', err);
    res.status(500).json({ error: 'Gửi email thất bại. Vui lòng thử lại sau.' });
  }
});

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default router;
