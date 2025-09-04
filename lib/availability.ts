// lib/availability.ts
import dayjs from 'dayjs';

/** โครงสร้าง soft-hold ใน RTDB:
 * slot_holds/{date}/{barberId}/{HH:mm} = { expires_at_ms?: number }
 */
export type HoldMap =
  Record<string,                           // date (YYYY-MM-DD)
    Record<string,                         // barberId
      Record<string, { expires_at_ms?: number }> // HH:mm
    >
  >;

export type UnavailBlock = {
  id: string;
  date: string;   // YYYY-MM-DD
  start: string;  // HH:mm
  end: string;    // HH:mm
  note?: string;
};

export type UnavailMap = Record<string, UnavailBlock[]>; // { [barberId]: blocks[] }

/** ตรวจว่าช่วง “ไม่รับคิว” บล็อกเวลานี้หรือไม่ (inclusive start, exclusive end) */
export function isBlockedAt(dateStr: string, hhmm: string, blocks: UnavailBlock[]): boolean {
  if (!blocks || blocks.length === 0) return false;
  const t = dayjs(`${dateStr} ${hhmm}`);
  return blocks.some(b => {
    if (b.date !== dateStr) return false;
    const s = dayjs(`${b.date} ${b.start}`);
    const e = dayjs(`${b.date} ${b.end}`);
    // true เมื่อ s <= t < e
    return !t.isBefore(s) && t.isBefore(e);
  });
}

/** ตรวจว่าเวลานี้ถูก hold โดยคนอื่นอยู่ไหม */
export function isHeldAt(
  holds: HoldMap | Record<string, Record<string, { expires_at_ms?: number }>>,
  dateStr: string,
  barberId: string | undefined,
  hhmm: string | undefined
): boolean {
  if (!barberId || !hhmm) return false;
  const node = (holds as any)?.[dateStr]?.[barberId]?.[hhmm];
  return !!(node && Number(node.expires_at_ms) > Date.now());
}

/** คำนวณรายการ “เวลาเริ่มต้น” ที่จองได้ โดยคำนึงถึง reserved/holds/unavailability ครบถ้วน */
export function computeAvailableStartTimes(params: {
  timeSlots: string[];  // รายการช่องเวลา HH:mm ของวันนั้น (ตัดพักเที่ยง/เวลาที่ผ่านแล้วแล้ว)
  hours: number;        // จำนวนชั่วโมงที่ต้องการจอง (>=1)
  dateStr: string;      // YYYY-MM-DD
  barberId?: string;
  reservedTimes: Set<string>;  // เวลาที่ถูกจองจริงแล้วของช่างคนนั้น (HH:mm)
  holds: HoldMap | Record<string, Record<string, { expires_at_ms?: number }>>;
  unavailability: UnavailMap;  // ช่วงไม่รับคิวของแต่ละช่าง
}): string[] {
  const { timeSlots, hours, dateStr, barberId, reservedTimes, holds, unavailability } = params;

  const h = Math.max(1, Number.isFinite(hours) ? hours : 1);
  const blocks = barberId ? (unavailability[barberId] || []) : [];

  return timeSlots.filter((start, idx) => {
    // เวลาต้นทางถูก hold หรือโดนบล็อกทั้งวัน/บางช่วง
    if (isHeldAt(holds as any, dateStr, barberId, start)) return false;
    if (isBlockedAt(dateStr, start, blocks)) return false;

    // ต้องมีช่วงต่อกันครบตามชั่วโมง และไม่ชน reserved/hold/unavail ใด ๆ
    for (let k = 0; k < h; k++) {
      const slot = timeSlots[idx + k];
      if (!slot) return false;

      const expected = dayjs(`${dateStr} ${start}`).add(k * 60, 'minute').format('HH:mm');
      if (slot !== expected) return false;

      if (reservedTimes.has(slot)) return false;
      if (isHeldAt(holds as any, dateStr, barberId, slot)) return false;
      if (isBlockedAt(dateStr, slot, blocks)) return false;
    }
    return true;
  });
}
