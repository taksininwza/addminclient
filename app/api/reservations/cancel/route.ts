import { NextResponse } from "next/server";
import { database } from "../../../../lib/firebase"; // ปรับเส้นทางตามโปรเจกต์
import { ref, get, remove } from "firebase/database";
import { sendLinePush } from "../../../../lib/line";

export async function POST(req: Request) {
  try {
    const { reservationId } = await req.json();
    if (!reservationId) {
      return NextResponse.json({ ok: false, error: "reservationId required" }, { status: 400 });
    }

    const node = ref(database, `reservations/${reservationId}`);
    const snap = await get(node);
    const data = snap.val();
    if (!data) {
      return NextResponse.json({ ok: false, error: "Reservation not found" }, { status: 404 });
    }

    // ลบคิว
    await remove(node);

    // ถ้ามี line_user_id -> แจ้งลูกค้า
    if (data.line_user_id) {
      const msg =
        `❌ ยกเลิกคิวของคุณ ${data.customer_name}\n` +
        `วันที่ ${data.appointment_date} เวลา ${data.appointment_time}\n` +
        `หากมีข้อสงสัย ติดต่อร้านได้เลยค่ะ 💅`;
      await sendLinePush(data.line_user_id, msg);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
