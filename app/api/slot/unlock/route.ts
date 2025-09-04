import { NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin'; 

type Body = { slotId: string; owner: string };

export async function POST(req: Request) {
  const { slotId, owner } = (await req.json()) as Body;
  if (!slotId || !owner) {
    return NextResponse.json({ ok: false, error: 'slotId_and_owner_required' }, { status: 400 });
  }

  const ref = db.ref(`slot_locks/${slotId}`);
  try {
    const tx = await ref.transaction((cur: any) => {
      if (!cur) return null;           // ไม่มี → ไม่เป็นไร
      if (cur.owner === owner) return null; // เจ้าของเดิม → ปลดล็อก
      return cur;                      // ไม่ใช่เจ้าของ → คงไว้
    });

    if (!tx.committed) return NextResponse.json({ ok: false, error: 'not_owner' }, { status: 403 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('unlock failed', e);
    return NextResponse.json({ ok: false, error: 'unlock_failed' }, { status: 500 });
  }
}
