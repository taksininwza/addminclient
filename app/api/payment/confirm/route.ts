// app/api/payment/confirm/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';         // ต้องใช้ Node.js runtime (ห้าม edge)
export const dynamic = 'force-dynamic';  // ห้าม prerender

type ConfirmPayload = {
  refCode: string;
  customerName?: string;
  serviceType?: string;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:mm
  hours: number;
  barber?: string;
  barberId: string;      // ใช้ล็อกคิว
  amountRead?: number | null;
  expected: number;
  matched: boolean;      // OCR ตรง
  createdAtISO?: string;
  slotId?: string;       // option
};

// --- Lazy Admin init (หลีกเลี่ยง error ตอน build) ---
let _adminInited = false;
function getAdminDb() {
  // ใช้ require เพื่อหนีการประเมินตอน build time
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getDatabase } = require('firebase-admin/database');

  if (!_adminInited) {
    const projectId   = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey    = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase admin envs');
    }

    // รองรับกรณี vercel เก็บ private key แบบมี \n
    if (privateKey?.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL, // แนะนำให้ตั้งใน Vercel ด้วย
      });
    }
    _adminInited = true;
  }

  const db = getDatabase();
  return db;
}

function badRequest(msg: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: msg, ...extra }, { status: 400 });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ConfirmPayload;

    // --- validate เบื้องต้น ---
    if (!body?.refCode)   return badRequest('missing_ref');
    if (!body?.date)      return badRequest('missing_date');
    if (!body?.time)      return badRequest('missing_time');
    if (!body?.barberId)  return badRequest('missing_barber_id');
    if (typeof body.hours !== 'number' || body.hours <= 0) {
      return badRequest('invalid_hours');
    }
    if (typeof body.expected !== 'number' || body.expected <= 0) {
      return badRequest('invalid_expected');
    }

    const db = getAdminDb();

    // --- สร้าง path สำหรับ lock คิวแบบ atomic ---
    const lockPath = `booked_slots/${body.date}/${body.barberId}/${body.time}`;
    const lockRef  = db.ref(lockPath);

    // ใช้ transaction กันชนคิวซ้ำ
    const txRes = await lockRef.transaction((current: unknown) => {
      // current === true แปลว่าถูกจอง/ยืนยันแล้ว
      if (current === true) return; // abort (no write)
      return true;                  // mark booked
    }, { applyLocally: false });

    if (!txRes.committed) {
      // มีคนจองไปก่อนหน้า
      return NextResponse.json(
        { ok: false, error: 'slot_already_booked' },
        { status: 409 }
      );
    }

    // --- บันทึก payment (สำหรับหน้าจอง/หน้า availability ใช้อ่านกันชน) ---
    const paymentsRef = db.ref('payments').push();
    const paymentId   = paymentsRef.key as string;

    const nowISO = new Date().toISOString();

    const paymentRecord = {
      id: paymentId,
      ref: body.refCode,
      customer_name: body.customerName || '',
      service_title: body.serviceType || '',
      date: body.date,
      time: body.time,
      hours: body.hours,
      barber: body.barber || '',     // เพื่อโชว์
      barber_id: body.barberId,      // ใช้ match ฝั่งลูกค้า/availability
      amount_read: body.amountRead ?? null,
      expected: Number(body.expected.toFixed(2)),
      matched: !!body.matched,
      status: body.matched ? 'confirmed' : 'pending', // ถ้า OCR ตรงให้ confirmed
      slot_id: body.slotId || null,
      created_at: body.createdAtISO || nowISO,
      server_time_ms: Date.now(),
    };

    await paymentsRef.set(paymentRecord);

    // (ถ้าต้องการสร้าง reservations ด้วย สามารถเพิ่มได้ที่นี่)
    // ตัวอย่าง:
    // if (body.matched) {
    //   const reservationsRef = db.ref('reservations').push();
    //   await reservationsRef.set({
    //     appointment_date: body.date,
    //     appointment_time: body.time,
    //     barber_id: body.barberId,
    //     customer_name: body.customerName || '',
    //     service_title: body.serviceType || '',
    //     created_at: nowISO,
    //     payment_id: paymentId,
    //   });
    // }

    return NextResponse.json({ ok: true, id: paymentId });
  } catch (err: any) {
    console.error('confirm payment error:', err);
    // แยกกรณี env admin ขาด
    if (String(err?.message || '').includes('Missing Firebase admin envs')) {
      return NextResponse.json(
        { ok: false, error: 'missing_admin_envs' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { ok: false, error: err?.message || 'internal_error' },
      { status: 500 }
    );
  }
}
