"use client";
import React, { useEffect, useMemo, useState } from "react";
import Calendar from "react-calendar";
import dayjs from "dayjs";
import "react-calendar/dist/Calendar.css";

// ✅ ดึงสถานะชำระเงินจาก Firebase
import { database, ref, onValue } from "../../lib/firebase";

interface Reservation {
  appointment_date: string;
  appointment_time: string;      // เวลาเริ่มเดิม (HH:mm)
  time_label?: string;           // เช่น "14:00–16:00"
  duration_hours?: number;       // เช่น 3
  barber_id: string;
  customer_name: string;
  phone?: string;
  note?: string;
  line_user_id?: string;

  // อาจมีถ้าเซฟไว้ตอนจอง
  payment_id?: string;
  payment_ref?: string;
  payment_status?: string;       // หรือ status
  status?: string;
}
interface Barber { name: string }

type MergedReservation = {
  ids: string[];
  appointment_date: string;
  barber_id: string;
  customer_name: string;
  phone?: string;
  note?: string;
  start_time: string;            // HH:mm
  end_time: string;              // HH:mm
  total_hours: number;
};

type Props = {
  reservations: Record<string, Reservation>;
  barbers: Record<string, Barber>;
};

const CalendarPage: React.FC<Props> = ({ reservations, barbers }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedBarber, setSelectedBarber] = useState<string>("");
  const [selectedReservation, setSelectedReservation] = useState<MergedReservation | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // ====== อ่าน payments เพื่อรู้ว่าอะไร "paid" ======
  const [paidIds, setPaidIds] = useState<string[]>([]);
  const [paidRefs, setPaidRefs] = useState<string[]>([]);

  useEffect(() => {
    const unsub = onValue(ref(database, "payments"), (snap) => {
      const val = snap.val() || {};
      const ids: string[] = [];
      const refs: string[] = [];
      Object.entries<any>(val).forEach(([pid, p]) => {
        const st = p.payment_status ?? p.status;
        if (st === "paid" || st === "success" || st === "completed") {
          ids.push(pid);
          if (p.payment_ref) refs.push(String(p.payment_ref));
        }
      });
      setPaidIds(ids);
      setPaidRefs(refs);
    });
    return () => unsub();
  }, []);

  const paidIdSet  = useMemo(() => new Set(paidIds),  [paidIds]);
  const paidRefSet = useMemo(() => new Set(paidRefs), [paidRefs]);

  // เช็คว่า reservation นี้จ่ายแล้วหรือยัง
  const isReservationPaid = (r: Reservation) => {
    const st = r.payment_status ?? r.status;
    if (st === "paid" || st === "success" || st === "completed") return true;
    if (r.payment_id && paidIdSet.has(r.payment_id)) return true;
    if (r.payment_ref && paidRefSet.has(String(r.payment_ref))) return true;
    return false;
  };

  const getBarberName = (id: string) => barbers[id]?.name || id || "ไม่ระบุช่าง";

  // ---- helpers ----
  const t2m = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map((v) => parseInt(v, 10));
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };
  const m2t = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(m)}`;
  };

  // แยกเวลาเริ่ม/จบ โดยพิจารณา time_label / duration_hours ก่อน
  const parseStartEnd = (res: Reservation) => {
    let startStr: string | undefined;
    let endStr: string | undefined;

    if (res.time_label) {
      const parts = res.time_label.split(/[–-]/).map((s) => s.trim());
      if (parts[0]) startStr = parts[0];
      if (parts[1]) endStr = parts[1];
    }
    if (!startStr) startStr = res.appointment_time;

    const startM = t2m(startStr);
    let endM: number;

    if (typeof res.duration_hours === "number" && res.duration_hours > 0) {
      endM = startM + Math.round(res.duration_hours * 60);
    } else if (endStr) {
      endM = t2m(endStr);
    } else {
      endM = startM + 60;
    }
    return { startM, endM };
  };

  // รวมตาม (วัน/ช่าง/ลูกค้า/phone/line_id) และ merge ช่วงที่ซ้อนทับ/ประชิดกัน
  const mergeReservations = (items: Array<{ id: string; res: Reservation }>): MergedReservation[] => {
    const groups = new Map<string, Array<{ id: string; res: Reservation; startM: number; endM: number }>>();

    for (const it of items) {
      const { startM, endM } = parseStartEnd(it.res);
      const key = `${it.res.appointment_date}|${it.res.barber_id}|${it.res.customer_name}|${it.res.phone ?? ""}|${it.res.line_user_id ?? ""}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ ...it, startM, endM });
    }

    const merged: MergedReservation[] = [];
    for (const [, arr] of groups) {
      arr.sort((a, b) => a.startM - b.startM);

      let cur: { ids: string[]; startM: number; endM: number; base: typeof arr[number] | null } = {
        ids: [], startM: -1, endM: -1, base: null
      };

      for (const seg of arr) {
        if (cur.base === null) {
          cur = { ids: [seg.id], startM: seg.startM, endM: seg.endM, base: seg };
        } else if (seg.startM <= cur.endM) {
          cur.ids.push(seg.id);
          cur.endM = Math.max(cur.endM, seg.endM);
        } else {
          merged.push({
            ids: cur.ids,
            appointment_date: cur.base!.res.appointment_date,
            barber_id: cur.base!.res.barber_id,
            customer_name: cur.base!.res.customer_name,
            phone: cur.base!.res.phone,
            note: cur.base!.res.note,
            start_time: m2t(cur.startM),
            end_time: m2t(cur.endM),
            total_hours: (cur.endM - cur.startM) / 60,
          });
          cur = { ids: [seg.id], startM: seg.startM, endM: seg.endM, base: seg };
        }
      }

      if (cur.base !== null) {
        merged.push({
          ids: cur.ids,
          appointment_date: cur.base.res.appointment_date,
          barber_id: cur.base.res.barber_id,
          customer_name: cur.base.res.customer_name,
          phone: cur.base.res.phone,
          note: cur.base.res.note,
          start_time: m2t(cur.startM),
          end_time: m2t(cur.endM),
          total_hours: (cur.endM - cur.startM) / 60,
        });
      }
    }

    merged.sort((a, b) => t2m(a.start_time) - t2m(b.start_time));
    return merged;
  };

  // ✅ ดึงเฉพาะ “การจองที่ชำระแล้ว” มารวม/แสดง
  const getMergedForDateAndBarber = (date: Date, barberId: string): MergedReservation[] => {
    const day = dayjs(date).format("YYYY-MM-DD");
    const items = Object.entries(reservations)
      .filter(([, r]) =>
        r.appointment_date === day &&
        (barberId === "" || r.barber_id === barberId) &&
        isReservationPaid(r) // <- ตรงนี้คือเงื่อนไขหลัก
      )
      .map(([id, res]) => ({ id, res }));
    return mergeReservations(items);
  };

  const selectedList = getMergedForDateAndBarber(selectedDate, selectedBarber);

  // ====== ยกเลิก (ยกเลิกทุก id ในก้อนเดียวกัน) ======
  const cancelReservation = async (ids: string[]) => {
    if (!confirm("ยืนยันการยกเลิกคิวนี้ทั้งหมด?")) return;
    setCancelLoading(true);
    try {
      for (const id of ids) {
        const res = await fetch("/api/reservations/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId: id }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "ยกเลิกคิวไม่สำเร็จ");
      }
      alert("ยกเลิกคิวสำเร็จ");
      setSelectedReservation(null);
    } catch (e: any) {
      alert(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 32, fontWeight: 700, color: "#22223b", marginBottom: 24 }}>
        📅 ปฏิทินการจอง
      </h1>

      {/* ตัวกรองช่าง */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontWeight: 500 }}>
          เลือกช่าง:{" "}
          <select
            value={selectedBarber}
            onChange={(e) => setSelectedBarber(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #cfd8dc", fontSize: 15, marginLeft: 8 }}
          >
            <option value="">ทั้งหมด</option>
            {Object.entries(barbers).map(([id, b]) => (
              <option key={id} value={id}>{b.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
        {/* ปฏิทิน */}
        <div style={{ flex: 1, minWidth: 320, maxWidth: 420, background: "#fff", borderRadius: 12, padding: 18 }}>
          <Calendar
            value={selectedDate}
            onChange={(v) => setSelectedDate(v as Date)}
            tileContent={({ date }) => {
              const count = getMergedForDateAndBarber(date, selectedBarber).length;
              return count > 0 ? (
                <div style={{ fontSize: "0.7em", color: "white", background: "#4caf50", borderRadius: 5, padding: 2, marginTop: 2 }}>
                  {count} รายการ
                </div>
              ) : null;
            }}
          />
        </div>

        {/* รายการรวมของวัน */}
        <div style={{ flex: 1, minWidth: 320, maxHeight: 480, overflowY: "auto", border: "1px solid #e0e0e0", borderRadius: 12, padding: 20, background: "#fff" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#22223b" }}>
            การจองวันที่ {dayjs(selectedDate).format("DD/MM/YYYY")}
          </h2>

          {selectedList.length ? (
            <ul style={{ listStyle: "none", padding: 0, marginTop: 10 }}>
              {selectedList.map((r, i) => (
                <li
                  key={i}
                  onClick={() => setSelectedReservation(r)}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 18px",
                    marginBottom: 10,
                    borderRadius: 10,
                    background: "#f9f9f9",
                    border: "1px solid #e0e0e0",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "#4f8cff" }}>{getBarberName(r.barber_id)}</div>
                  <div>
                    🧑 {r.customer_name}{" "}
                    <span style={{ color: "#43e97b", fontWeight: 600 }}>
                      ⏰ {r.start_time}–{r.end_time}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>ไม่มีการจอง</p>
          )}
        </div>
      </div>

      {/* Modal */}
      {selectedReservation && (
        <div
          onClick={() => setSelectedReservation(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", padding: 28, borderRadius: 14, maxWidth: 420, width: "90%" }}
          >
            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 18 }}>📋 รายละเอียดการจอง</h3>

            <p><strong>ชื่อ:</strong> {selectedReservation.customer_name}</p>
            <p><strong>เบอร์โทร:</strong> {selectedReservation.phone || "-"}</p>
            <p><strong>ช่าง:</strong> {getBarberName(selectedReservation.barber_id)}</p>
            <p><strong>เวลา:</strong> {selectedReservation.start_time}–{selectedReservation.end_time}</p>
            <p><strong>ระยะเวลา:</strong> {selectedReservation.total_hours} ชั่วโมง</p>
            <p><strong>หมายเหตุ:</strong> {selectedReservation.note || "-"}</p>

            <div style={{ fontWeight: 700, marginTop: 12 }}>หมายเลขการจอง</div>
            <div
              style={{
                background: "#f6f8fa",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "10px 12px",
                fontFamily: "ui-monospace, Menlo, Consolas, 'Courier New', monospace",
                fontSize: 13,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {selectedReservation.ids.join(", ")}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button
                onClick={() => setSelectedReservation(null)}
                style={{ padding: "8px 18px", background: "#4f8cff", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 16, cursor: "pointer" }}
              >
                ปิด
              </button>
              <button
                onClick={() => cancelReservation(selectedReservation.ids)}
                disabled={cancelLoading}
                style={{ padding: "8px 18px", background: "#e63946", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 16, cursor: "pointer", opacity: cancelLoading ? 0.7 : 1 }}
              >
                {cancelLoading ? "กำลังยกเลิก..." : "ยกเลิกคิว"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
