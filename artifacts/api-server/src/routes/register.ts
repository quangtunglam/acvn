/**
 * POST /register/member  — public member registration form
 * POST /register/sponsor — public sponsor registration form
 */
import { Router, type Request, type Response } from 'express';
import { db, memberRegistrationsTable, sponsorRegistrationsTable } from '@workspace/db';

const router = Router();

router.post('/register/member', async (req: Request, res: Response): Promise<void> => {
  const { fullName, email, dateOfBirth, address, phone, occupation, notes } = req.body as Record<string, string>;
  if (!fullName?.trim() || !email?.trim()) {
    res.status(400).json({ error: 'Vui lòng điền họ tên và email.' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Địa chỉ email không hợp lệ.' });
    return;
  }
  if (db) {
    await db.insert(memberRegistrationsTable).values({
      fullName: fullName.trim(),
      email: email.trim(),
      dateOfBirth: dateOfBirth?.trim() || null,
      address: address?.trim() || null,
      phone: phone?.trim() || null,
      occupation: occupation?.trim() || null,
      notes: notes?.trim() || null,
    });
  }
  res.json({ ok: true });
});

router.post('/register/sponsor', async (req: Request, res: Response): Promise<void> => {
  const { orgName, email, representative, phone, sponsorType, details, notes } = req.body as Record<string, string>;
  if (!orgName?.trim() || !email?.trim()) {
    res.status(400).json({ error: 'Vui lòng điền tên tổ chức/cá nhân và email.' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Địa chỉ email không hợp lệ.' });
    return;
  }
  if (db) {
    await db.insert(sponsorRegistrationsTable).values({
      orgName: orgName.trim(),
      email: email.trim(),
      representative: representative?.trim() || null,
      phone: phone?.trim() || null,
      sponsorType: sponsorType?.trim() || null,
      details: details?.trim() || null,
      notes: notes?.trim() || null,
    });
  }
  res.json({ ok: true });
});

export default router;
