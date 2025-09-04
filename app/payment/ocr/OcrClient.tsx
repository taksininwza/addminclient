'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Tesseract from 'tesseract.js';
import Image from 'next/image';

// ❌ ห้าม export dynamic/revalidate/fetchCache ในไฟล์ client

// RTDB (client)
import { database, ref, onValue, remove } from '@/lib/firebase';
import { runTransaction, update } from 'firebase/database';

const PINK = '#F48FB1';
const DEEP_PINK = '#AD1457';
const BG = '#FFF7FB';

const API_BASE = '/api';
const FETCH_URL = `${API_BASE}/payment/confirm`;
const UNIT_PER_HOUR = Number(process.env.NEXT_PUBLIC_DEPOSIT_AMOUNT || 100);

// soft-hold
const HOLD_PATH = (date: string, barberId: string, time: string) => `slot_holds/${date}/${barberId}/${time}`;
const HOLD_KEEPALIVE_MS = 10_000;
const HOLD_TTL_MS = 25_000;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 6px 24px rgba(0,0,0,.08)', padding: 20 }}>
      <div style={{ color: DEEP_PINK, fontWeight: 800, fontSize: 18, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

type OCRResult = { text: string; amount?: number; hasRef: boolean };

export default function OcrClient() {
  const params = useSearchParams();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // -------- read params --------
  const expectedParam = useMemo(() => {
    const raw = params.get('expected');
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
  }, [params]);

  const refCode      = params.get('ref')     || 'NAIL-REF-XXXXXX';
  const customerName = params.get('name')    || '';
  const serviceType  = params.get('service') || '';
  const date         = params.get('date')    || '';
  const time         = params.get('time')    || '';
  const hoursStr     = params.get('hours')   || '1';
  const barber       = params.get('barber')  || '';
  const barberId     = params.get('barberId') || '';
  const minutes      = useMemo(() => parseInt(params.get('minutes') || '15', 10), [params]);

  const hoursNum = useMemo(() => {
    const h = Number(hoursStr);
    return Number.isFinite(h) && h > 0 ? Math.floor(h) : 1;
  }, [hoursStr]);

  const fracFromRef = useMemo(() => {
    let v = 0;
    for (const ch of refCode) v = (v * 31 + ch.charCodeAt(0)) % 100;
    return v / 100;
  }, [refCode]);

  const uniqueFrac = useMemo(() => {
    const cents = Math.round((expectedParam % 1) * 100);
    return (cents > 0 ? cents : Math.round(fracFromRef * 100)) / 100;
  }, [expectedParam, fracFromRef]);

  const totalExpected = useMemo(
    () => Number((UNIT_PER_HOUR * hoursNum + uniqueFrac).toFixed(2)),
    [hoursNum, uniqueFrac]
  );

  const slotId = useMemo(() => {
    const sanitize = (s: string) => s.trim().replace(/\s+/g, '-').replace(/[.#$/[\]]/g, '-').toUpperCase();
    const tSafe = time.replace(':', '-');
    return `${sanitize(barber)}_${sanitize(date)}_${sanitize(tSafe)}`;
  }, [barber, date, time]);

  const qrUrl = useMemo(() => {
    const amt = Math.max(0, totalExpected);
    return `${API_BASE}/payment/qr?amount=${encodeURIComponent(amt.toFixed(2))}&ref=${encodeURIComponent(refCode)}`;
  }, [totalExpected, refCode]);

  // -------- OCR state --------
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [showBookedPopup, setShowBookedPopup] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // ===== SOFT-HOLD =====
  const [myHoldAcquired, setMyHoldAcquired] = useState(false);
  const keepAliveTimerRef = useRef<number | null>(null);
  const myClientId = useMemo(() => {
    const key = 'nailties_client_id';
    let id: string | null = null;
    try { id = localStorage.getItem(key); } catch {}
    if (!id) {
      id = 'C' + Math.random().toString(36).slice(2, 10).toUpperCase();
      try { localStorage.setItem(key, id); } catch {}
    }
    return id || 'C-UNKNOWN';
  }, []);

  const holdRef = useMemo(() => {
    if (!date || !time || !barberId) return null;
    return ref(database, HOLD_PATH(date, barberId, time));
  }, [date, time, barberId]);

  // try acquire hold
  useEffect(() => {
    if (!holdRef) return;

    let cancelled = false;

    runTransaction(holdRef as any, (current: any) => {
      const now = Date.now();
      const alive = current && Number(current.expires_at_ms) > now;
      if (alive && current.owner && current.owner !== myClientId) {
        return current;
      }
      return {
        owner: myClientId,
        refCode,
        created_at_ms: current?.created_at_ms || now,
        expires_at_ms: now + HOLD_TTL_MS,
      };
    }).then((res: any) => {
      if (cancelled || !res?.snapshot) return;
      const v = res.snapshot.val();
      const now = Date.now();
      const alive = v && Number(v.expires_at_ms) > now;
      const mine = alive && v.owner === myClientId;
      if (!mine) setShowBookedPopup(true);
      else setMyHoldAcquired(true);
    });

    const unsub = onValue(holdRef as any, (snap: any) => {
      if (!snap) return;
      const v = snap.val();
      if (!v) return;
      const now = Date.now();
      const alive = Number(v.expires_at_ms) > now;
      if (alive && v.owner && v.owner !== myClientId) {
        setShowBookedPopup(true);
      }
    });

    return () => {
      cancelled = true;
      try { typeof unsub === 'function' && unsub(); } catch {}
    };
  }, [holdRef, myClientId, refCode]);

  // keep-alive
  useEffect(() => {
    if (!holdRef || !myHoldAcquired) return;

    function ping() {
      const now = Date.now();
      update(holdRef as any, { expires_at_ms: now + HOLD_TTL_MS }).catch(() => {});
    }

    ping();
    const t = window.setInterval(ping, HOLD_KEEPALIVE_MS);
    keepAliveTimerRef.current = t;

    const offUnload = () => {
      try { if (holdRef) remove(holdRef as any); } catch {}
    };

    window.addEventListener('beforeunload', offUnload);
    window.addEventListener('pagehide', offUnload);

    return () => {
      if (keepAliveTimerRef.current) {
        window.clearInterval(keepAliveTimerRef.current);
        keepAliveTimerRef.current = null;
      }
      window.removeEventListener('beforeunload', offUnload);
      window.removeEventListener('pagehide', offUnload);
      try { if (holdRef) remove(holdRef as any); } catch {}
    };
  }, [holdRef, myHoldAcquired]);

  // if lost hold → back to booking
  useEffect(() => {
    if (!showBookedPopup) return;
    const to = setTimeout(() => router.replace('/booking'), 1200);
    return () => clearTimeout(to);
  }, [showBookedPopup, router]);

  // OCR helpers
  function extractAmount(text: string): number | undefined {
    const cleaned = text.replace(/[,\s]+/g, ' ');
    const tokens = cleaned.match(/\d+(?:[ .]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{2}/g) || [];
    if (tokens.length === 0) return undefined;

    const candidates = tokens
      .map((t) => t.replace(/\s/g, '').replace(/,/g, '.'))
      .map((t) => Number(t))
      .filter((n) => Number.isFinite(n));

    let best = candidates[0];
    let bestDiff = Math.abs(best - totalExpected);
    for (const n of candidates) {
      const d = Math.abs(n - totalExpected);
      if (d < bestDiff) { best = n; bestDiff = d; }
    }
    return Number(best.toFixed(2));
  }

  function hasRef(text: string, ref: string): boolean {
    const norm = (s: string) => s.replace(/\s/g, '').toUpperCase();
    return norm(text).includes(norm(ref));
  }

  const satangs = (n: number) => Math.round(n * 100);

  async function downscaleToObjectURL(file: File, maxW = 1280, maxH = 1280): Promise<string> {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(maxW / bitmap.width, maxH / bitmap.height, 1);
    const w = Math.round(bitmap.width * ratio);
    const h = Math.round(bitmap.height * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85)
    );
    if (!blob) return URL.createObjectURL(file);
    return URL.createObjectURL(blob);
  }

  async function runOcr(url: string) {
    setRunning(true);
    setProgress(0);
    setResult(null);
    setError(null);

    try {
      const { data } = await Tesseract.recognize(url, 'tha+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text' && m.progress) {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const text  = data?.text || '';
      const amt   = extractAmount(text);
      const refOk = hasRef(text, refCode);

      setResult({ text, amount: amt, hasRef: refOk });
    } catch (e) {
      console.error(e);
      setError('อ่านสลิปไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setRunning(false);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    if (fileUrl) URL.revokeObjectURL(fileUrl);
    const url = await downscaleToObjectURL(f);
    setFileUrl(url);
    setTimeout(() => runOcr(url), 50);
  }

  // -------- confirm --------
  async function handleConfirm() {
    if (!isOk || running || !fileUrl) return;
    try {
      setSaving(true);

      const payload = {
        refCode,
        customerName,
        serviceType,
        date,
        time,
        hours: hoursNum,
        barber,
        amountRead: result?.amount ?? null,
        expected: totalExpected,
        matched: isOk,
        createdAtISO: new Date().toISOString(),
        slotId,
        barberId,
      };

      const res = await fetch(FETCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const j = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        if (res.status === 409 && (j?.error === 'slot_already_booked' || j?.error === 'already_booked')) {
          setShowBookedPopup(true);
          return;
        }
        throw new Error(j?.error || res.statusText || 'บันทึกข้อมูลไม่สำเร็จ');
      }

      if (holdRef) { try { await remove(holdRef as any); } catch {} }
      setShowSummary(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    try {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      if (holdRef) { try { await remove(holdRef as any); } catch {} }
    } finally {
      router.push('/booking');
    }
  }

  const isOk =
    !!result &&
    result.amount !== undefined &&
    satangs(result.amount) === satangs(totalExpected);

  // countdown
  const [remainSec, setRemainSec] = useState<number>(0);
  useEffect(() => {
    if (!mounted) return;
    const expiresAt = Date.now() + minutes * 60_000;
    const tick = () => {
      const leftSec = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemainSec(leftSec);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [mounted, minutes]);

  useEffect(() => {
    return () => { if (fileUrl) URL.revokeObjectURL(fileUrl); };
  }, [fileUrl]);

  const bookingText = useMemo(() => {
    const dd = date ? new Date(`${date}T00:00:00`) : null;
    const dStr = dd ? dd.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: '2-digit' }) : '';
    return [
      `ยืนยันการจองคิวทำเล็บ`,
      `ชื่อ: ${customerName || '-'}`,
      `บริการ: ${serviceType || '-'}`,
      `ช่าง: ${barber || '-'}`,
      `วันเวลา: ${time || '-'} ${dStr || ''}`,
      `ระยะเวลา: ${hoursNum} ชั่วโมง`,
      `ยอดชำระ: ${totalExpected.toFixed(2)} บาท`,
      `รหัสอ้างอิง: ${refCode}`,
    ].join('\n');
  }, [customerName, serviceType, barber, date, time, hoursNum, totalExpected, refCode]);

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(bookingText);
      alert('คัดลอกข้อมูลสรุปแล้ว ✓');
    } catch {
      alert('คัดลอกไม่สำเร็จ');
    }
  }

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  async function downloadCardPng() {
    const w = 1080, h = 620;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d')!;

    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#FFE4F3');
    g.addColorStop(1, '#EFE9FF');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const cardW = w - 80, cardH = h - 80, cardX = 40, cardY = 40;
    ctx.fillStyle = '#fff';
    roundRect(ctx, cardX, cardY, cardW, cardH, 28);
    ctx.fill();

    ctx.fillStyle = DEEP_PINK;
    ctx.font = 'bold 40px Inter, Arial';
    ctx.fillText('ใบยืนยันการจอง', cardX + 30, cardY + 70);

    ctx.fillStyle = '#222';
    ctx.font = 'bold 30px Inter, Arial';
    const y0 = cardY + 120, lh = 44;
    const lines = bookingText.split('\n');
    lines.forEach((t, i) => ctx.fillText(t, cardX + 30, y0 + i * lh));

    ctx.fillStyle = PINK;
    roundRect(ctx, w - 420, cardY + 36, 350, 44, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px Inter, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`REF: ${refCode}`, w - 245, cardY + 66);
    ctx.textAlign = 'start';

    ctx.fillStyle = '#777';
    ctx.font = '24px Inter, Arial';
    ctx.fillText('Nailties — ขอบคุณที่ไว้วางใจค่ะ 💅', cardX + 30, cardY + cardH - 26);

    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nailties-booking-${refCode}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png', 0.95);
  }

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 860, display: 'grid', gap: 16 }}>
        {/* Header */}
        <div style={{ background: '#fff', borderRadius: 18, padding: 18, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 6px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            <Image src="/logo.png" alt="Nailties logo" width={44} height={44} priority style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div style={{ color: DEEP_PINK, fontWeight: 900, fontSize: 22 }}>อัปโหลดสลิปเพื่อยืนยันการชำระ</div>
            <div style={{ color: '#666' }}>สแกน QR โอน → อัปโหลดสลิป ระบบจะอ่านยอด</div>
          </div>
        </div>

        {/* QR */}
        <Card title="สแกนเพื่อชำระ (PromptPay)">
          <div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
            <img src={qrUrl} alt="PromptPay QR" style={{ width: 260, height: 260, borderRadius: 16, objectFit: 'contain', border: `1px solid ${PINK}` }} />
            <div style={{ textAlign: 'center', color: '#666' }}>
              โอนยอด <b>{totalExpected.toFixed(2)}</b> บาท (ภายใน {Math.floor(remainSec/60)} นาที {String(remainSec%60).padStart(2,'0')} วินาที)
            </div>
          </div>
        </Card>

        {/* Summary */}
        <Card title="ข้อมูลการจอง">
          <div style={{ display: 'grid', gap: 6 }}>
            {customerName && <div><b>ชื่อ: </b>{customerName}</div>}
            {serviceType  && <div><b>บริการ: </b>{serviceType}</div>}
            {(barber || barberId) && <div><b>ช่าง: </b>{barber || barberId}</div>}
            {(date || time) && <div><b>เวลา: </b>{time} {date}</div>}
            <div><b>ระยะเวลา: </b>{hoursNum} ชั่วโมง</div>
            <div><b>ยอดที่ต้องชำระ: </b><span style={{ color: DEEP_PINK, fontWeight: 900 }}>{totalExpected.toFixed(2)} บาท</span></div>
          </div>
        </Card>

        {/* Uploader */}
        <Card title="อัปโหลดรูปสลิป">
          <div style={{ display: 'grid', gap: 12 }}>
            {!fileUrl ? (
              <label style={{ border: `2px dashed ${PINK}`, borderRadius: 14, padding: 20, display: 'grid', placeItems: 'center', cursor: 'pointer', background: '#fff' }}>
                <div style={{ textAlign: 'center', color: '#666' }}>คลิกเพื่อเลือกไฟล์ / ลากรูปมาวาง (PNG/JPG)</div>
                <input type="file" accept="image/*" onChange={onPickFile} style={{ display: 'none' }} />
              </label>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                <img src={fileUrl} alt="slip" style={{ width: 260, height: 260, objectFit: 'contain', border: `1px solid ${PINK}`, borderRadius: 16 }} />
                {running ? (
                  <div style={{ color: DEEP_PINK, fontWeight: 800 }}>
                    กำลังอ่านสลิป… {progress}%
                    <div style={{ height: 8, background: '#fde4f0', borderRadius: 999, marginTop: 6 }}>
                      <div style={{ width: `${progress}%`, height: '100%', background: PINK, borderRadius: 999 }} />
                    </div>
                  </div>
                ) : (
                  <>
                    {error && <div style={{ color: '#b00020', background: '#ffeaea', padding: 8, borderRadius: 8 }}>{error}</div>}
                    {result && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            padding: '6px 10px',
                            borderRadius: 999,
                            fontWeight: 800,
                            background: isOk ? '#e8f8ef' : '#fff6e6',
                            color: isOk ? '#087f5b' : '#9a5b00',
                            border: `1px solid ${isOk ? '#c8f0de' : '#ffd9a8'}`
                          }}
                        >
                          {isOk ? 'ยอดตรง ✓ พร้อมยืนยัน' : `ยอดยังไม่ตรง ${totalExpected.toFixed(2)} บาท`}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ปุ่มยืนยัน/ยกเลิก */}
            <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
              <button
                onClick={handleConfirm}
                disabled={!isOk || running || !fileUrl || saving || !myHoldAcquired}
                style={{
                  background: isOk && !saving && myHoldAcquired ? PINK : '#ddd',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontWeight: 800,
                  cursor: isOk && !saving && myHoldAcquired ? 'pointer' : 'not-allowed',
                  minWidth: 200,
                  opacity: saving ? 0.85 : 1
                }}
              >
                {saving ? 'กำลังบันทึก…' : 'ยืนยันการชำระเงิน'}
              </button>

              <button
                onClick={handleCancel}
                type="button"
                style={{
                  background: '#fff',
                  border: '2px solid #ef9a9a',
                  color: '#c62828',
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </Card>

        <Card title="หมายเหตุ">
          <ul style={{ margin: 0, paddingLeft: 18, color: '#555' }}>
            <li>โอนผิดหรือโอนเกินไม่รับผิดชอบทุกรณี</li>
            <li>หากมาสายเกิน 30 นาที ถือว่าลูกค้าได้ทำการยกเลิกการจองคิว ทางร้านขอสงวนสิทธิ์ยึดมัดจำทันที</li>
            <li>การทำเล็บอาจเสร็จเร็วหรือช้ากว่าที่เวลากำหนดขึ้นอยู่กับลายหรือเหตุผลอื่นๆ</li>
          </ul>
        </Card>
      </div>

      {/* Overlay */}
      {saving && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,.65)', display: 'grid', placeItems: 'center', zIndex: 50, backdropFilter: 'blur(2px)' }}>
          <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', border: '6px solid #fce1f0', borderTopColor: '#c2185b', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontWeight: 900, color: DEEP_PINK }}>กำลังบันทึก…</div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ถูกแย่งคิว */}
      {showBookedPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', zIndex: 60, display: 'grid', placeItems: 'center' }}>
          <div style={{ width: 340, background: '#fff', borderRadius: 18, padding: 22, display: 'grid', gap: 12, justifyItems: 'center', boxShadow: '0 20px 60px rgba(173,20,87,.25)' }}>
            <div style={{ width: 78, height: 78, borderRadius: '50%', background: '#FFE3E6', display: 'grid', placeItems: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#AD1457" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ fontWeight: 900, color: DEEP_PINK, fontSize: 18 }}>คิวนี้ถูกปิดชั่วคราว</div>
            <div style={{ color: '#666', textAlign: 'center' }}>มีผู้อื่นกำลังทำรายการเวลานี้ กรุณาเลือกเวลาใหม่ค่ะ</div>
            <div style={{ display: 'grid', gap: 8, width: '100%' }}>
              <button onClick={() => router.replace('/booking')} style={{ background: '#fff', border: '2px solid #ef9a9a', color: '#c62828', borderRadius: 10, padding: '10px 14px', fontWeight: 800 }}>
                ไปจองใหม่
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {showSummary && (
        <SummaryModal
          text={[
            `ยืนยันการจองคิวทำเล็บ`,
            `ชื่อ: ${customerName || '-'}`,
            `บริการ: ${serviceType || '-'}`,
            `ช่าง: ${barber || '-'}`,
            `วันเวลา: ${time || '-'} ${date || ''}`,
            `ระยะเวลา: ${hoursNum} ชั่วโมง`,
            `ยอดชำระ: ${totalExpected.toFixed(2)} บาท`,
            `รหัสอ้างอิง: ${refCode}`,
          ].join('\n')}
          refCode={refCode}
          onCopy={copySummary}
          onDownload={downloadCardPng}
          onClose={() => router.push('/')}
        />
      )}
    </div>
  );
}

function SummaryModal({
  text, refCode, onCopy, onDownload, onClose,
}: { text: string; refCode: string; onCopy: () => void; onDownload: () => void; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', zIndex: 70, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{ width: 'min(560px, 96vw)', background: '#fff', borderRadius: 18, padding: 22, display: 'grid', gap: 14, boxShadow: '0 20px 60px rgba(173,20,87,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 54, height: 54, borderRadius: 999, background: PINK, display: 'grid', placeItems: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M20 7L9 18l-5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 900, color: DEEP_PINK, fontSize: 20 }}>ยืนยันการชำระเงินสำเร็จ</div>
            <div style={{ color: '#64748b' }}>สรุปการจองของคุณ</div>
          </div>
        </div>

        <div style={{ background: '#fff7fb', border: '1px solid #ffd6ec', borderRadius: 12, padding: 14, whiteSpace: 'pre-wrap', color: '#334155' }}>
          {text}
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <button onClick={onDownload} style={{ background: 'linear-gradient(135deg,#ff7ac8,#b07cff)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px', fontWeight: 800, cursor: 'pointer' }}>
            ดาวน์โหลดบัตรคิว (PNG)
          </button>
          <button onClick={onCopy} style={{ background: '#fff', border: `2px solid ${PINK}`, color: DEEP_PINK, borderRadius: 10, padding: '10px 14px', fontWeight: 800, cursor: 'pointer' }}>
            คัดลอกข้อความสรุป
          </button>
          <button onClick={onClose} style={{ marginTop: 4, background: DEEP_PINK, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px', fontWeight: 800 }}>
            กลับหน้าแรก
          </button>
        </div>
      </div>
    </div>
  );
}
