// app/api/confirm/route.ts  (หรือ app/api/payment/confirm/route.ts ให้ตรงกับ fetch)
import { NextResponse } from 'next/server';
import { rtdb, serverTimestamp } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      refCode, customerName, serviceType, date, time, hours, barber,
      amountRead, expected, matched, createdAtISO, slotId,
    } = body || {};

    if (!slotId) {
      return NextResponse.json({ ok:false, error:'missing_slotId' }, { status: 400 });
    }
    if (typeof expected !== 'number') {
      return NextResponse.json({ ok:false, error:'invalid_expected' }, { status: 400 });
    }

    // 1) ถ้าชำระสำเร็จ ให้ "ล็อกคิว" ด้วย RTDB transaction (กันจองซ้ำ)
    if (matched) {
      const slotRef = rtdb.ref(`bookingSlots/${slotId}`);

      const { committed, snapshot } = await slotRef.transaction((curr: any) => {
        // ถ้าเคยล็อก/จองไว้แล้ว ให้ยกเลิก (return undefined)
        if (curr?.locked === true || curr?.status === 'confirmed') return;

        // otherwise สร้าง/อัปเดตเป็น confirmed + locked
        const base = {
          locked: true,
          status: 'confirmed',
          customerName: customerName || null,
          serviceType:  serviceType  || null,
          date:         date         || null,
          time:         time         || null,
          hours: Number.isFinite(Number(hours)) ? Number(hours) : null,
          barber: barber || null,
          paymentRef: refCode || null,
          updatedAt: serverTimestamp,
        };
        // ถ้ายังไม่มี ให้ตั้ง createdAt ด้วย
        if (!curr) return { ...base, createdAt: serverTimestamp };
        return { ...curr, ...base };
      });

      if (!committed) {
        // สล็อตนี้ปิดไปแล้ว
        return NextResponse.json({ ok:false, error:'slot_already_booked' }, { status: 409 });
      }
    }

    // 2) บันทึกประวัติการชำระเงิน (จองสำเร็จ/ไม่สำเร็จ ก็เก็บได้)
    const payRef = rtdb.ref('payments').push();
    await payRef.set({
      refCode: refCode || null,
      customerName: customerName || null,
      serviceType: serviceType || null,
      date: date || null,
      time: time || null,
      hours: Number.isFinite(Number(hours)) ? Number(hours) : null,
      barber: barber || null,
      amountRead: typeof amountRead === 'number' ? amountRead : null,
      expected,
      matched: !!matched,
      status: matched ? 'confirmed' : 'mismatch',
      slotId: slotId,
      createdAtISO: createdAtISO || null,
      createdAt: serverTimestamp,
    });

    return NextResponse.json({ ok:true, id: payRef.key });
  } catch (e:any) {
    console.error('[confirm] ', e?.message || e);
    return NextResponse.json({ ok:false, error: e?.message || 'save_failed' }, { status: 500 });
  }
}
