// app/api/slot/lock/route.ts
import { NextResponse } from 'next/server';
import { rtdb as db } from '@/lib/firebaseAdmin';

type Body = { slotId: string; owner: string; ttlSec?: number };

export async function POST(req: Request) {
  try {
    const { slotId, owner, ttlSec = 180 } = (await req.json()) as Body;
    if (!slotId || !owner) return NextResponse.json({ error: 'invalid_params' }, { status: 400 });

    const now = Date.now();                           // เวลาเซิร์ฟเวอร์
    const skew = 2000;                                // อนุโลม clock skew 2s
    const expiresAtMs = now + ttlSec * 1000;

    const ref = db.ref(`slot_locks/${slotId}`);
    const tx = await ref.transaction((cur: any) => {
      if (!cur) return { owner, expires_at_ms: expiresAtMs };

      const curExp = Number(cur?.expires_at_ms || 0);
      const isExpired = curExp + skew <= now;
      const sameOwner = cur?.owner === owner;

      if (isExpired || sameOwner) {
        // ต่ออายุได้เมื่อหมดอายุแล้ว หรือเป็นเจ้าของเดิม
        return { owner, expires_at_ms: expiresAtMs };
      }
      // คนอื่นกำลังถืออยู่
      return undefined;
    });

    if (!tx.committed) {
      const snap = await ref.once('value');
      const cur = snap.val();
      return NextResponse.json(
        { error: 'slot_locked', expiresAtMs: cur?.expires_at_ms || null },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, expiresAtMs }, { status: 200 });
  } catch (e) {
    console.error('lock error', e);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
