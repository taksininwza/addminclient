// utils/promptpay.ts
import QRCode from 'qrcode';

/** TLV encoder */
function tlv(id: string, value: string) {
  const v = String(value ?? '');
  const len = v.length.toString().padStart(2, '0');
  return `${id}${len}${v}`;
}

/** CRC16/IBM (Poly 0x1021, Init 0xFFFF) */
function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** แปลง PromptPay ID ให้ถูกฟอร์แมต + ระบุชนิด (mobile/nid) */
function formatPromptPayId(input: string): { subId: '01' | '02', value: string } {
  const raw = (input || '').replace(/\D/g, '');
  if (/^0\d{9}$/.test(raw)) {
    // เบอร์มือถือ 10 หลัก -> 0066 + ตัด 0 ตัวหน้า
    return { subId: '01', value: '0066' + raw.slice(1) };
  }
  if (/^\d{13}$/.test(raw)) {
    // เลขบัตรประชาชน
    return { subId: '02', value: raw };
  }
  // fallback: พยายามใช้เป็นเบอร์
  return { subId: '01', value: '0066' + raw.replace(/^0/, '') };
}

/**
 * สร้าง EMV payload ของ Thai PromptPay (Dynamic + Amount + Ref)
 * - id: เบอร์มือถือ (0xxxxxxxxx) หรือเลขบัตร 13 หลัก
 * - amount: จำนวนเงิน (สองตำแหน่งทศนิยม)
 * - ref: รหัสอ้างอิงบิล (แสดงใน tag 62-05)
 */
export function buildPromptPayEMV(id: string, amount: number, ref?: string, opts?: {
  merchantName?: string, merchantCity?: string
}) {
  const { subId, value } = formatPromptPayId(id);
  const name = (opts?.merchantName || 'NAILTIES').toUpperCase().slice(0, 25);
  const city = (opts?.merchantCity || 'BANGKOK').toUpperCase().slice(0, 15);

  // Merchant Account Information (ID 29)
  const mai =
    tlv('00', 'A000000677010111') +  // PromptPay AID
    tlv(subId, value);               // 01=mobile, 02=national id

  let payload =
    tlv('00', '01') +                // Payload Format Indicator
    tlv('01', '12') +                // Point of Initiation: 12 = dynamic
    tlv('29', mai) +                 // Merchant Account Info
    tlv('52', '0000') +              // MCC (optional -> 0000)
    tlv('53', '764') +               // Currency THB
    tlv('54', Number(amount).toFixed(2)) + // Amount (2 decimals)
    tlv('58', 'TH') +                // Country
    tlv('59', name) +                // Merchant Name (ASCII)
    tlv('60', city);                 // City (ASCII)

  // Additional Data Field Template (tag 62) -> Bill/Ref
  if (ref) {
    const refClean = String(ref).replace(/\s/g, '').slice(0, 25);
    const adf = tlv('05', refClean); // 05 = Bill number / Ref
    payload += tlv('62', adf);
  }

  // CRC
  const toCrc = payload + '6304';
  const crc = crc16(toCrc);
  return toCrc + crc;
}

/** คืน Buffer PNG ของ QR (ใช้ใน API) */
export async function generatePromptPayQR(id: string, amount: number, ref?: string) {
  const emv = buildPromptPayEMV(id, amount, ref);
  // ใส่ margin ให้สแกนง่าย
  return await QRCode.toBuffer(emv, { type: 'png', margin: 1, width: 512 });
}
