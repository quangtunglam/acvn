/**
 * POST /contact — saves submission to DB; also emails if SMTP is configured.
 */
import nodemailer from 'nodemailer';
import { Router, type Request, type Response } from 'express';
import { db, contactSubmissionsTable } from '@workspace/db';

const router = Router();
const CONTACT_TO = process.env.CONTACT_EMAIL_TO ?? 'tung@pamacorp.com';

function makeTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

router.post('/contact', async (req: Request, res: Response): Promise<void> => {
  const { name, email, phone, subject, message } = req.body as {
    name?: string; email?: string; phone?: string; subject?: string; message?: string;
  };

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

  // Always save to DB
  await db.insert(contactSubmissionsTable).values({
    name: name.trim(),
    email: email.trim(),
    phone: phone?.trim() || null,
    subject: subject.trim(),
    message: message.trim(),
  });

  // Also try email if SMTP is configured
  const transport = makeTransport();
  if (transport) {
    const phoneInfo = phone?.trim() ? `\nĐiện thoại: ${phone.trim()}` : '';
    try {
      await transport.sendMail({
        from: `"ACVN Website" <${process.env.SMTP_USER}>`,
        replyTo: `"${name}" <${email}>`,
        to: CONTACT_TO,
        subject: `[ACVN Liên hệ] ${subject}`,
        text: `Họ tên: ${name}\nEmail: ${email}${phoneInfo}\nTiêu đề: ${subject}\n\nNội dung:\n${message}`,
      });
    } catch (err) {
      console.error('[contact] sendMail error:', err);
    }
  }

  res.json({ ok: true });
});

export default router;
