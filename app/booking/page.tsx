// app/booking/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { database, ref, onValue } from "../../lib/firebase";
import { computeUniqueAmount } from '../../lib/uniqueAmount';

type Barber = { name: string };
type Reservation = {
  appointment_date: string;
  appointment_time: string;
  barber_id?: string;
  customer_name: string;
  phone?: string;
  note?: string;
  service_title?: string;
  created_at?: string;
};

type Payment = {
  date?: string;
  time?: string;
  barber?: string;
  barber_id?: string;
  status?: string;
  matched?: boolean;
};

const DEPOSIT_THB = Number(process.env.NEXT_PUBLIC_DEPOSIT_AMOUNT || 100);

// ===== Navbar styles =====
const LOGO_SIZE = 80;
const navBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  color: "#0f172a",
  fontWeight: 700,
  textDecoration: "none",
  background: "#fff",
};
const primaryBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid transparent",
  background: "linear-gradient(135deg,#ff7ac8,#b07cff)",
  color: "#fff",
  fontWeight: 800,
  textDecoration: "none",
};

// ===== Booking styles =====
const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #eef2f7",
  boxShadow: "0 6px 24px rgba(2,6,23,.05)",
};

const services = [
  { id: "manicure",  title: "ทำเล็บมือ (ตัดแต่ง + ทาสี)" },
  { id: "pedicure",  title: "ทำเล็บเท้า" },
  { id: "extension", title: "ต่อเล็บเจล/อะคริลิค" },
  { id: "paint",     title: "เพ้นท์ลาย" },
  { id: "removal",   title: "ถอด/ล้างเจล" },
  { id: "spa",       title: "สปามือ/สปาเท้า" },
];

// ===== ตั้งค่าเวลาร้าน =====
const OPEN_HOUR  = 10;
const CLOSE_HOUR = 20;
const SLOT_MIN   = 60;
const LUNCH_START = 12;
const LUNCH_END   = 13;

// ====== Helpers (รองรับเลขไทย/อารบิก) ======
const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
function toArabicDigits(s: string) {
  return s.replace(/[๐-๙]/g, (c) => String(THAI_DIGITS.indexOf(c)));
}
function stripNonDigits(s: string) {
  return toArabicDigits(s).replace(/\D/g, '');
}
function stripDigitsFromName(s: string) {
  // ลบทั้งเลขอารบิกและเลขไทย
  return s.replace(/[0-9๐-๙]/g, '');
}

export default function BookingPage() {
  const router = useRouter();

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState<string>(services[0].id);
  const [dateStr, setDateStr] = useState(dayjs().format("YYYY-MM-DD"));
  const [note, setNote] = useState("");
  const [selectedBarberId, setSelectedBarberId] = useState<string>("");

  // ⭐ ระยะเวลา (ชั่วโมง) — เลือกได้หลายชั่วโมง
  const [durationHours, setDurationHours] = useState<number>(1);

  const [barbers, setBarbers] = useState<Record<string, Barber>>({});
  const [reservations, setReservations] = useState<Record<string, Reservation>>({});
  const [payments, setPayments] = useState<Record<string, Payment>>({});

  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // โหลดรายชื่อช่าง + การจอง + การชำระ
  useEffect(() => {
    const unsubBarbers = onValue(ref(database, "barbers"), (s) => {
      const b = s.val() || {};
      setBarbers(b);
      if (!selectedBarberId && Object.keys(b).length > 0) {
        setSelectedBarberId(Object.keys(b)[0]);
      }
    });
    const unsubRes = onValue(ref(database, "reservations"), (s) => {
      setReservations(s.val() || {});
    });
    const unsubPays = onValue(ref(database, "payments"), (s) => {
      setPayments(s.val() || {});
    });
    return () => {
      unsubBarbers();
      unsubRes();
      unsubPays();
    };
  }, [selectedBarberId]);

  // สร้างช่วงเวลา 10–20 (เว้นพักเที่ยง) และตัดเวลาที่ผ่านมาใน "วันนี้"
  const timeSlots = useMemo(() => {
    const base = dayjs(dateStr);
    const slots: string[] = [];
    let t = base.hour(OPEN_HOUR).minute(0).second(0).millisecond(0);
    const end = base.hour(CLOSE_HOUR).minute(0).second(0).millisecond(0);

    while (t.isBefore(end)) {
      const h = t.hour();
      if (h < LUNCH_START || h >= LUNCH_END) slots.push(t.format("HH:mm"));
      t = t.add(SLOT_MIN, "minute");
    }

    if (base.isSame(dayjs(), "day")) {
      return slots.filter((hhmm) => dayjs(`${dateStr} ${hhmm}`).isAfter(dayjs()));
    }
    return slots;
  }, [dateStr]);

  // ชื่อช่าง
  const barberName = useMemo(
    () => (selectedBarberId ? barbers[selectedBarberId]?.name : undefined),
    [selectedBarberId, barbers]
  );

  // ช่องเวลาที่ถูกจองแล้ว (จาก LINE + จากการชำระยืนยันแล้ว)
  const reservedTimes = useMemo(() => {
    const set = new Set<string>();

    // จาก reservations/*
    Object.values(reservations || {}).forEach((r) => {
      if (!r) return;
      const sameDate = r.appointment_date === dateStr;
      const sameBarber = selectedBarberId ? r.barber_id === selectedBarberId : true;
      if (sameDate && sameBarber && r.appointment_time) {
        set.add(r.appointment_time);
      }
    });

    // จาก payments/* (เฉพาะที่ยืนยันแล้ว)
    Object.values(payments || {}).forEach((p) => {
      if (!p) return;
      const isConfirmed = p.status === 'confirmed' || p.matched === true;
      if (!isConfirmed) return;

      const sameDate = p.date === dateStr;
      const sameBarber =
        selectedBarberId
          ? (p.barber_id && p.barber_id === selectedBarberId) ||
            (!!barberName && !!p.barber && p.barber.toUpperCase() === barberName.toUpperCase())
          : true;

      if (sameDate && sameBarber && p.time) {
        set.add(p.time);
      }
    });

    return set;
  }, [reservations, payments, dateStr, selectedBarberId, barberName]);

  // ⭐ คำนวณ "เวลาเริ่มต้น" ที่จองได้ โดยต้องมี slot ว่างติดกันตามจำนวนชั่วโมงที่เลือก
  const availableStartTimes = useMemo(() => {
    // ต้องมีอย่างน้อย 1 ชม.
    const h = Math.max(1, durationHours);

    return timeSlots.filter((start, idx) => {
      for (let k = 0; k < h; k++) {
        const slot = timeSlots[idx + k];
        if (!slot) return false;
        const expected = dayjs(`${dateStr} ${start}`).add(k * SLOT_MIN, "minute").format("HH:mm");
        if (slot !== expected) return false;            // ต้องต่อกันจริง ๆ ทีละ 60 นาที
        if (reservedTimes.has(slot)) return false;      // ห้ามชนกับที่ถูกจอง
      }
      return true;
    });
  }, [timeSlots, durationHours, reservedTimes, dateStr]);

  // สำหรับแสดงช่วงเวลา start–end
  const renderRange = (start: string) => {
    const end = dayjs(`${dateStr} ${start}`).add(durationHours * SLOT_MIN, "minute").format("HH:mm");
    return `${start}–${end}`;
  };

  // ====== Key filters ======
  const onNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // บล็อกตัวเลข (ทั้ง 0-9 และ ๐-๙)
    if (/[0-9๐-๙]/.test(e.key)) e.preventDefault();
  };
  const onPhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // อนุญาตปุ่มควบคุมพื้นฐาน
    const ok = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Home','End'];
    if (ok.includes(e.key)) return;
    // อนุญาตเฉพาะตัวเลข 0-9 (เลขไทยจะถูกแปลงใน onChange)
    if (!/^[0-9]$/.test(e.key)) e.preventDefault();
  };

  // กดจอง
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nameClean = customerName.trim();
    const phoneClean = stripNonDigits(phone);

    if (!nameClean) return setError("กรุณากรอกชื่อ");
    if (/[0-9๐-๙]/.test(nameClean)) return setError("ชื่อห้ามมีตัวเลข");

    if (!dateStr) return setError("กรุณาเลือกวันที่");
    const chosenStart = (document.querySelector('input[name="timeStart"]:checked') as HTMLInputElement | null)?.value;
    if (!chosenStart) return setError("กรุณาเลือกเวลาเริ่มต้น");
    if (!selectedBarberId) return setError("กรุณาเลือกช่าง");

    // สร้างรายการเวลาทั้งช่วงตามชั่วโมงที่เลือก
    const selectedTimes: string[] = Array.from({ length: durationHours }, (_, k) =>
      dayjs(`${dateStr} ${chosenStart}`).add(k * SLOT_MIN, "minute").format("HH:mm")
    );

    // กันชนซ้ำจาก reservations
    const clashFromReservations = Object.values(reservations).some(
      (r) =>
        r.appointment_date === dateStr &&
        r.barber_id === selectedBarberId &&
        selectedTimes.includes(r.appointment_time)
    );

    // กันชนซ้ำจาก payments (ที่ยืนยันแล้ว)
    const barberNm = barbers[selectedBarberId]?.name || '';
    const clashFromPayments = Object.values(payments).some((p) => {
      const isConfirmed = p?.status === 'confirmed' || p?.matched === true;
      if (!isConfirmed) return false;
      const sameDate = p?.date === dateStr;
      const sameBarber =
        p?.barber_id
          ? p.barber_id === selectedBarberId
          : (p?.barber && barberNm && p.barber.toUpperCase() === barberNm.toUpperCase());
      return !!(sameDate && sameBarber && p?.time && selectedTimes.includes(p.time));
    });

    if (clashFromReservations || clashFromPayments) {
      return setError("ช่วงเวลานี้ถูกปิดการจองแล้ว กรุณาเลือกเวลาอื่น");
    }

    // ---------- redirect ไปหน้า OCR ----------
    setRedirecting(true);

    const refCode = "NAIL-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const chosenService = services.find((s) => s.id === serviceId)?.title || "";
    const barberNameSel = barbers[selectedBarberId]?.name || "";

    // ใช้เศษสตางค์ไม่ซ้ำ เดิมตามระบบ
    const base   = DEPOSIT_THB * 1;
    const unique = computeUniqueAmount(base, refCode);

    const params = new URLSearchParams({
      expected: unique.toFixed(2),
      ref: refCode,
      name: nameClean,
      service: chosenService,
      date: dateStr,
      time: chosenStart,
      hours: String(durationHours),
      barber: barberNameSel,
      minutes: '15'
    });

    router.push(`/payment/ocr?${params.toString()}`);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 10% -10%, #ffe4f3 0%, transparent 60%), radial-gradient(900px 500px at 90% 0%, #e9e7ff 0%, transparent 50%), #ffffff",
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      {/* ===== Navbar ===== */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backdropFilter: "saturate(180%) blur(6px)",
          background: "rgba(255,255,255,.7)",
          borderBottom: "1px solid #f1f5f9",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "#0f172a" }}>
            <Image src="/logo.png" alt="Nailties logo" width={LOGO_SIZE} height={LOGO_SIZE} style={{ borderRadius: 10 }} priority />
            <span style={{ fontWeight: 900, letterSpacing: 0.2, fontSize: 22 }}>Nailties</span>
          </Link>

          <nav style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <Link href="/booking" style={primaryBtn}>จองคิว</Link>
            <Link href="/" style={navBtn}>บริการ</Link>
            <Link href="/login" style={navBtn}>Login</Link>
          </nav>
        </div>
      </header>

      {/* ===== Booking Form ===== */}
      <section style={{ maxWidth: 1000, margin: "24px auto", padding: "0 16px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: "#c2185b", marginBottom: 14 }}>
          จองคิวทำเล็บ
        </h1>

        <form onSubmit={handleSubmit} style={{ ...card, padding: 18 }}>
          {/* บริการ + ช่าง */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontWeight: 800, color: "#c2185b" }}>บริการ</label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid #ffd6ec", background: "#fff" }}
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontWeight: 800, color: "#c2185b" }}>เลือกช่าง</label>
              <select
                value={selectedBarberId}
                onChange={(e) => setSelectedBarberId(e.target.value)}
                style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid #ffd6ec", background: "#fff" }}
              >
                {Object.entries(barbers).map(([id, b]) => (
                  <option key={id} value={id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* วันที่ + ระยะเวลา */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontWeight: 800, color: "#c2185b" }}>วันที่</label>
              <div style={{ marginTop: 6 }}>
                <input
                  type="date"
                  min={dayjs().format("YYYY-MM-DD")}
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  style={{
                    width: "100%",
                    height: 44,
                    padding: "10px 12px",
                    fontSize: 16,
                    borderRadius: 10,
                    border: "1px solid #ffd6ec",
                    background: "#fff",
                    display: "block",
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontWeight: 800, color: "#c2185b" }}>ระยะเวลา (ชั่วโมง)</label>
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(Math.max(1, Number(e.target.value)))}
                style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid #ffd6ec", background: "#fff" }}
              >
                {[1,2,3,4,5,6,7,8].map(h => (
                  <option key={h} value={h}>{h} ชั่วโมง</option>
                ))}
              </select>
            </div>
          </div>

          {/* เวลาเริ่ม (ต้องมีช่วงต่อกันครบตามชั่วโมงที่เลือก) */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 800, color: "#c2185b", display: "block", marginBottom: 6 }}>
              เวลา (เริ่มต้น) — จอง {durationHours} ชั่วโมง
            </label>
            {availableStartTimes.length === 0 ? (
              <div style={{ border: "1px dashed #ffd6ec", borderRadius: 10, padding: 14, color: "#64748b" }}>
                ไม่มีเวลาว่างตามระยะเวลาที่เลือก
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                {availableStartTimes.map((t) => (
                  <label key={t} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #ffd6ec", padding: "10px 12px", borderRadius: 10, cursor: "pointer", background: "#fff" }}>
                    <input type="radio" name="timeStart" value={t} />
                    <span style={{ fontWeight: 700 }}>{renderRange(t)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* ข้อมูลลูกค้า */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontWeight: 800, color: "#c2185b" }}>ชื่อ </label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(stripDigitsFromName(e.target.value))}
                onKeyDown={onNameKeyDown}
                onBlur={(e) => setCustomerName(stripDigitsFromName(e.target.value.trim()))}
                placeholder="ชื่อของคุณ"
                // ช่วย browser validation (กันเลขอารบิก)
                pattern="[^0-9]+"
                style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid #ffd6ec", background: "#fff" }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 800, color: "#c2185b" }}>เบอร์โทร </label>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                value={phone}
                onKeyDown={onPhoneKeyDown}
                onChange={(e) => setPhone(stripNonDigits(e.target.value))}
                onBlur={(e) => setPhone(stripNonDigits(e.target.value))}
                placeholder="08xxxxxxxx"
                style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid #ffd6ec", background: "#fff" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 800, color: "#c2185b" }}>หมายเหตุ (ถ้ามี)</label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="สี/ทรง/ลาย ที่ต้องการหรือข้อความเพิ่มเติม"
              style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid #ffd6ec", background: "#fff", resize: "vertical" }}
            />
          </div>

          {error && (
            <div style={{ color: "#e63946", background: "#ffeaea", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={redirecting || availableStartTimes.length === 0}
              style={{
                padding: "12px 18px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg,#ff7ac8,#b07cff)",
                color: "#fff",
                fontWeight: 900,
                cursor: "pointer",
                minWidth: 160,
                opacity: redirecting ? 0.7 : 1,
                boxShadow: "0 8px 20px rgba(176,124,255,.25)",
              }}
            >
              {redirecting ? "กำลังไปหน้าอัปโหลดสลิป..." : "จองคิว"}
            </button>
          </div>
        </form>
      </section>

      {/* Loading Overlay */}
      {redirecting && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(255,255,255,.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            backdropFilter: "blur(3px)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: "50%",
                border: "6px solid #fce1f0",
                borderTopColor: "#c2185b",
                animation: "spin 1s linear infinite",
              }}
            />
            <div style={{ fontWeight: 800, color: "#c2185b" }}>กำลังไปหน้าอัปโหลดสลิป…</div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}
