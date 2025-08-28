// app/booking/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import Link from "next/link";
import Image from "next/image";
// ปรับ path ถ้า lib อยู่ตำแหน่งอื่น
import { database, ref, onValue, push, set } from "../../lib/firebase";

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

// ===== Navbar styles (เหมือนหน้า nail-home) =====
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
  { id: "manicure", title: "ทำเล็บมือ (ตัดแต่ง + ทาสี)" },
  { id: "pedicure", title: "ทำเล็บเท้า" },
  { id: "extension", title: "ต่อเล็บเจล/อะคริลิค" },
  { id: "paint", title: "เพ้นท์ลาย" },
  { id: "removal", title: "ถอด/ล้างเจล" },
  { id: "spa", title: "สปามือ/สปาเท้า" },
];

// ===== ตั้งค่าเวลาร้าน =====
const OPEN_HOUR = 10;       // เปิด 10:00
const CLOSE_HOUR = 20;      // ปิด 20:00 (สล็อตสุดท้ายเริ่ม 19:00)
const SLOT_MIN = 60;        // ⏱️ ช่องละ "1 ชั่วโมง"
const LUNCH_START = 12;     // ข้าม 12:00
const LUNCH_END = 13;       // ถึง 12:59

export default function BookingPage() {
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState<string>(services[0].id);
  const [dateStr, setDateStr] = useState(dayjs().format("YYYY-MM-DD"));
  const [note, setNote] = useState("");
  const [selectedBarberId, setSelectedBarberId] = useState<string>("");

  const [barbers, setBarbers] = useState<Record<string, Barber>>({});
  const [reservations, setReservations] = useState<Record<string, Reservation>>({});

  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub1 = onValue(ref(database, "barbers"), (s) => {
      const b = s.val() || {};
      setBarbers(b);
      if (!selectedBarberId && Object.keys(b).length > 0) {
        setSelectedBarberId(Object.keys(b)[0]);
      }
    });
    const unsub2 = onValue(ref(database, "reservations"), (s) => {
      setReservations(s.val() || {});
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, [selectedBarberId]);

  // สร้างช่วงเวลาของวันที่เลือก: 10:00–20:00 (ทีละ 60 นาที) และ "ข้าม" 12:00–13:00
  const timeSlots = useMemo(() => {
    const base = dayjs(dateStr);
    const slots: string[] = [];
    let t = base.hour(OPEN_HOUR).minute(0).second(0).millisecond(0);
    const end = base.hour(CLOSE_HOUR).minute(0).second(0).millisecond(0);

    while (t.isBefore(end)) {
      const h = t.hour();
      // ข้ามช่วงพักกลางวัน 12:00–12:59
      if (h < LUNCH_START || h >= LUNCH_END) {
        slots.push(t.format("HH:mm"));
      }
      t = t.add(SLOT_MIN, "minute");
    }

    // ถ้าวันที่เลือกเป็น "วันนี้" ให้ตัดเวลาที่ผ่านมาแล้วออก
    if (base.isSame(dayjs(), "day")) {
      return slots.filter((hhmm) => dayjs(`${dateStr} ${hhmm}`).isAfter(dayjs()));
    }
    return slots;
  }, [dateStr]);

  // เวลาที่ถูกจองแล้ว (ยึดตาม barber เดียวกัน)
  const reservedTimes = useMemo(() => {
    const list = Object.values(reservations);
    return new Set(
      list
        .filter(
          (r) =>
            r.appointment_date === dateStr &&
            (selectedBarberId ? r.barber_id === selectedBarberId : true)
        )
        .map((r) => r.appointment_time)
    );
  }, [reservations, dateStr, selectedBarberId]);

  const availableTimes = timeSlots.filter((t) => !reservedTimes.has(t));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResultMsg(null);

    if (!customerName.trim()) return setError("กรุณากรอกชื่อ");
    if (!dateStr) return setError("กรุณาเลือกวันที่");
    const chosenRadio = (document.querySelector('input[name="time"]:checked') as HTMLInputElement | null)?.value;
    if (!chosenRadio) return setError("กรุณาเลือกเวลา");
    if (!selectedBarberId) return setError("กรุณาเลือกช่าง");

    try {
      setSubmitting(true);
      const clash = Object.values(reservations).some(
        (r) =>
          r.appointment_date === dateStr &&
          r.appointment_time === chosenRadio &&
          r.barber_id === selectedBarberId
      );
      if (clash) {
        setError("ช่วงเวลานี้มีการจองแล้ว กรุณาเลือกเวลาอื่น");
        setSubmitting(false);
        return;
      }

      const chosenService = services.find((s) => s.id === serviceId)?.title || "";
      const newRef = push(ref(database, "reservations"));
      const payload: Reservation = {
        appointment_date: dateStr,
        appointment_time: chosenRadio,
        barber_id: selectedBarberId,
        customer_name: customerName.trim(),
        phone: phone.trim(),
        note: note.trim(),
        service_title: chosenService,
        created_at: new Date().toISOString(),
      };
      await set(newRef, payload);

      setResultMsg(
        `✅ จองคิวสำเร็จ!\nชื่อ: ${payload.customer_name}\nบริการ: ${chosenService}\nช่าง: ${barbers[selectedBarberId]?.name || "-"}\nวันที่ ${payload.appointment_date} เวลา ${payload.appointment_time}\nรหัสจอง: ${newRef.key}`
      );
      (document.querySelector('input[name="time"]:checked') as HTMLInputElement | null)?.blur();
      const radio = document.querySelector('input[name="time"]:checked') as HTMLInputElement | null;
      if (radio) radio.checked = false;
      setNote("");
    } catch (err) {
      console.error(err);
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
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
      {/* ===== Navbar (เหมือนหน้า nail-home) ===== */}
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

          {/* วันที่ */}
          {/* วันที่ */}
<div style={{ marginBottom: 12 }}>
  <label style={{ fontWeight: 800, color: "#c2185b" }}>วันที่</label>
  <div style={{ marginTop: 6 }}>
    <input
      type="date"
      min={dayjs().format("YYYY-MM-DD")}
      value={dateStr}
      onChange={(e) => setDateStr(e.target.value)}
      style={{
        width: "100%",       // รีสปอนซีฟสำหรับจอเล็ก
        maxWidth: 320,       // ❗️จำกัดความกว้างสูงสุด (ปรับเป็น 280–360 ได้)
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


          {/* เวลา */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 800, color: "#c2185b", display: "block", marginBottom: 6 }}>เวลา (ว่าง)</label>
            {availableTimes.length === 0 ? (
              <div style={{ border: "1px dashed #ffd6ec", borderRadius: 10, padding: 14, color: "#64748b" }}>
                ไม่มีเวลาว่างในวันที่เลือก
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                {availableTimes.map((t) => (
                  <label key={t} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #ffd6ec", padding: "10px 12px", borderRadius: 10, cursor: "pointer", background: "#fff" }}>
                    <input type="radio" name="time" value={t} />
                    <span style={{ fontWeight: 700 }}>{t}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* ข้อมูลลูกค้า */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontWeight: 800, color: "#c2185b" }}>ชื่อ</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="ชื่อของคุณ"
                style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid #ffd6ec", background: "#fff" }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 800, color: "#c2185b" }}>เบอร์โทร </label>
              <input    
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08x-xxx-xxxx"
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

          {resultMsg && (
            <div style={{ color: "#c2185b", background: "#fff0f7", border: "1px solid #ffd6ec", borderRadius: 8, padding: "10px 12px", marginBottom: 10, whiteSpace: "pre-wrap", fontWeight: 700 }}>
              {resultMsg}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={submitting || availableTimes.length === 0}
              style={{
                padding: "12px 18px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg,#ff7ac8,#b07cff)",
                color: "#fff",
                fontWeight: 900,
                cursor: "pointer",
                minWidth: 160,
                opacity: submitting ? 0.7 : 1,
                boxShadow: "0 8px 20px rgba(176,124,255,.25)",
              }}
            >
              {submitting ? "กำลังบันทึก..." : "จองคิว"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
