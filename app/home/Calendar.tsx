// app/home/Calendar.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
import Calendar from "react-calendar";
import dayjs from "dayjs";
import "react-calendar/dist/Calendar.css";
import { database, ref, onValue } from "../../lib/firebase";

interface Reservation {
  appointment_date: string;
  appointment_time: string;      // HH:mm
  time_label?: string;           // "14:00–16:00"
  duration_hours?: number;       // 3
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

  // ✅ ธงใช้แต้ม
  use_point?: boolean | string | number;
}
interface Barber { name: string }

interface Payment {
  date?: string;                 // YYYY-MM-DD
  time?: string;                 // HH:mm
  hours?: number;
  barber?: string;
  barber_id?: string;
  customerName?: string;
  phone?: string;
  note?: string;

  status?: string;
  matched?: boolean;
  payment_status?: string;
  createdAt?: number;
  createdAtISO?: string;
  payment_ref?: string;

  // ✅ เผื่อมีจากเว็บ
  use_point?: boolean | string | number;
}

type Src = "web" | "line";
type IdTuple = { id: string; source: Src };

type MergedReservation = {
  ids: string[];
  idTuples: IdTuple[];           // เก็บ (id, source) สำหรับยกเลิก
  appointment_date: string;
  barber_id: string;
  customer_name: string;
  phone?: string;
  note?: string;
  start_time: string;            // HH:mm
  end_time: string;              // HH:mm
  total_hours: number;
  source: "web" | "line" | "mixed";
  usedPoint?: boolean;           // ✅ ใช้แต้มสะสมหรือไม่ (รวม)
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

  /** ===== payments + paid sets ===== */
  const [payments, setPayments] = useState<Record<string, Payment>>({});
  const [paidIds, setPaidIds] = useState<string[]>([]);
  const [paidRefs, setPaidRefs] = useState<string[]>([]);

  // helpers
  const toLower = (s?: string) => (s || "").toLowerCase();
  const boolish = (v: any) => v === true || v === "true" || v === 1 || v === "1";
  const isCancelled = (s?: string) =>
    ["cancel", "cancelled", "canceled", "void", "refund", "refunded"].includes(toLower(s));
  const isPaidWord = (s?: string) =>
    ["paid", "success", "completed", "confirmed"].includes(toLower(s));

  useEffect(() => {
    const unsub = onValue(ref(database, "payments"), (snap) => {
      const val = (snap.val() || {}) as Record<string, Payment>;
      setPayments(val);

      const ids: string[] = [];
      const refs: string[] = [];
      Object.entries(val).forEach(([pid, p]) => {
        const st = p.payment_status ?? p.status;
        if (isCancelled(st)) return;           // ห้ามนับถ้ายกเลิก
        const paid = p.matched === true || isPaidWord(st);
        if (paid) {
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

  // LINE: ถ้ายกเลิกในฟิลด์ไหน ให้ไม่แสดง
  const isReservationPaid = (r: Reservation) => {
    if (isCancelled(r.status) || isCancelled(r.payment_status)) return false;
    if (r.payment_id && paidIdSet.has(r.payment_id)) return true;
    if (r.payment_ref && paidRefSet.has(String(r.payment_ref))) return true;
    return isPaidWord(r.payment_status) || isPaidWord(r.status);
  };

  // WEB: ถ้ายกเลิก -> ไม่แสดง
  const isPaymentPaid = (p: Payment) => {
    if (isCancelled(p.status) || isCancelled(p.payment_status)) return false;
    if (p.matched === true) return true;
    return isPaidWord(p.payment_status) || isPaidWord(p.status);
  };

  const getBarberName = (id: string) => barbers[id]?.name || id || "ไม่ระบุช่าง";

  // ---- time utils ----
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

  const findBarberIdByName = (name?: string): string | undefined => {
    if (!name) return undefined;
    const target = name.trim().toLowerCase();
    const entry = Object.entries(barbers).find(([_, b]) => (b.name || "").trim().toLowerCase() === target);
    return entry?.[0];
  };

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

  /** รวมรายการพร้อมจำที่มา (line/web) + บอกว่าใช้แต้มไหม */
  const mergeReservations = (
    items: Array<{ id: string; res: Reservation; source: Src; usedPoint?: boolean }>
  ): MergedReservation[] => {
    const groups = new Map<
      string,
      Array<{ id: string; res: Reservation; source: Src; startM: number; endM: number; usedPoint: boolean }>
    >();

    for (const it of items) {
      const { startM, endM } = parseStartEnd(it.res);
      const key = `${it.res.appointment_date}|${it.res.barber_id}|${it.res.customer_name}|${it.res.phone ?? ""}|${it.res.line_user_id ?? ""}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ ...it, startM, endM, usedPoint: !!it.usedPoint });
    }

    const merged: MergedReservation[] = [];
    for (const [, arr] of groups) {
      arr.sort((a, b) => a.startM - b.startM);

      let cur:
        | {
            ids: string[];
            tuples: IdTuple[];
            startM: number;
            endM: number;
            base: typeof arr[number];
            srcSet: Set<Src>;
            usedPoint: boolean;
          }
        | null = null;

      for (const seg of arr) {
        if (!cur) {
          cur = {
            ids: [seg.id],
            tuples: [{ id: seg.id, source: seg.source }],
            startM: seg.startM,
            endM: seg.endM,
            base: seg,
            srcSet: new Set([seg.source]),
            usedPoint: seg.usedPoint,
          };
        } else if (seg.startM <= cur.endM) {
          cur.ids.push(seg.id);
          cur.tuples.push({ id: seg.id, source: seg.source });
          cur.endM = Math.max(cur.endM, seg.endM);
          cur.srcSet.add(seg.source);
          cur.usedPoint = cur.usedPoint || seg.usedPoint;   // ✅ ถ้ามีช่วงไหนใช้แต้ม ให้รวมเป็น true
        } else {
          merged.push({
            ids: cur.ids,
            idTuples: cur.tuples,
            appointment_date: cur.base.res.appointment_date,
            barber_id: cur.base.res.barber_id,
            customer_name: cur.base.res.customer_name,
            phone: cur.base.res.phone,
            note: cur.base.res.note,
            start_time: m2t(cur.startM),
            end_time: m2t(cur.endM),
            total_hours: (cur.endM - cur.startM) / 60,
            source: cur.srcSet.size === 2 ? "mixed" : (Array.from(cur.srcSet)[0] as "web" | "line"),
            usedPoint: cur.usedPoint,
          });
          cur = {
            ids: [seg.id],
            tuples: [{ id: seg.id, source: seg.source }],
            startM: seg.startM,
            endM: seg.endM,
            base: seg,
            srcSet: new Set([seg.source]),
            usedPoint: seg.usedPoint,
          };
        }
      }

      if (cur) {
        merged.push({
          ids: cur.ids,
          idTuples: cur.tuples,
          appointment_date: cur.base.res.appointment_date,
          barber_id: cur.base.res.barber_id,
          customer_name: cur.base.res.customer_name,
          phone: cur.base.res.phone,
          note: cur.base.res.note,
          start_time: m2t(cur.startM),
          end_time: m2t(cur.endM),
          total_hours: (cur.endM - cur.startM) / 60,
          source: cur.srcSet.size === 2 ? "mixed" : (Array.from(cur.srcSet)[0] as "web" | "line"),
          usedPoint: cur.usedPoint,
        });
      }
    }

    merged.sort((a, b) => t2m(a.start_time) - t2m(b.start_time));
    return merged;
  };

  /** รวมข้อมูลที่ “ชำระแล้วและไม่ถูกยกเลิก” จาก LINE + WEB */
  const getMergedForDateAndBarber = (date: Date, barberId: string): MergedReservation[] => {
    const day = dayjs(date).format("YYYY-MM-DD");

    // LINE
    const resItems = Object.entries(reservations)
      .filter(([, r]) =>
        r.appointment_date === day &&
        (barberId === "" || r.barber_id === barberId) &&
        isReservationPaid(r)
      )
      .map(([id, res]) => ({
        id,
        res,
        source: "line" as const,
        usedPoint: boolish((res as any).use_point), // ✅
      }));

    // WEB (แปลงให้เป็นโครง Reservation)
    const payItems = Object.entries(payments)
      .filter(([, p]) => p.date === day && isPaymentPaid(p))
      .filter(([, p]) => {
        if (!barberId) return true;
        const pid = p.barber_id || findBarberIdByName(p.barber);
        return pid ? pid === barberId : true;
      })
      .map(([id, p]) => {
        const pid = p.barber_id || findBarberIdByName(p.barber) || (p.barber || "ไม่ระบุช่าง");
        const normRes: Reservation = {
          appointment_date: p.date || day,
          appointment_time: p.time || "00:00",
          duration_hours: typeof p.hours === "number" ? p.hours : 1,
          barber_id: pid,
          customer_name: p.customerName || "-",
          phone: p.phone,
          note: p.note,
          payment_ref: p.payment_ref,
          payment_status: p.payment_status ?? p.status,
          status: p.status,
          use_point: p.use_point, // ✅ เผื่อกรณีชำระบนเว็บแล้วใช้แต้ม
        };
        return { id, res: normRes, source: "web" as const, usedPoint: boolish(p.use_point) };
      });

    return mergeReservations([...resItems, ...payItems]);
  };

  const selectedList = getMergedForDateAndBarber(selectedDate, selectedBarber);

  /** ===== ยกเลิกทั้งฝั่ง LINE/WEB ตามชนิด ===== */
  const cancelReservation = async (tuples: IdTuple[]) => {
    if (!confirm("ยืนยันการยกเลิกคิวนี้ทั้งหมด?")) return;
    setCancelLoading(true);
    try {
      const lineIds = tuples.filter(t => t.source === "line").map(t => t.id);
      const webIds  = tuples.filter(t => t.source === "web").map(t => t.id);

      // LINE
      await Promise.all(
        lineIds.map(async (id) => {
          const res = await fetch("/api/reservations/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reservationId: id }),
          });
          const json = await res.json();
          if (!json.ok) throw new Error(json.error || "Reservation cancel failed");
        })
      );

      // WEB
      await Promise.all(
        webIds.map(async (id) => {
          const res = await fetch("/api/payment/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId: id }),
          });
          const json = await res.json();
          if (!json.ok) throw new Error(json.error || "Payment cancel failed");
        })
      );

      alert("ยกเลิกคิวสำเร็จ");
      setSelectedReservation(null);
    } catch (e: any) {
      alert(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setCancelLoading(false);
    }
  };

  // badge แหล่งที่มา
  const chip = (src: "web" | "line" | "mixed") => {
    const base: React.CSSProperties = { padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 800, border: "1px solid" };
    if (src === "web")  return { ...base, background: "#e0f2fe", color: "#0369a1", borderColor: "#bae6fd" };
    if (src === "line") return { ...base, background: "#e8f7ee", color: "#0f7a4b", borderColor: "#c8efd9" };
    return { ...base, background: "#fff6e6", color: "#9a5b00", borderColor: "#ffd9a8" };
  };
  // ✅ ป้าย “ใช้แต้ม”
  const pointChip: React.CSSProperties = {
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fde68a",
  };

  return (
    <div>
      <h1 style={{ fontSize: 32, fontWeight: 700, color: "#22223b", marginBottom: 24 }}>
        📅 ปฏิทินการจอง
      </h1>

      {/* filter ช่าง */}
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
              const count = getMergedForDateAndBarber(date as Date, selectedBarber).length;
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
                    background: r.usedPoint ? "#fffbeb" : "#f9f9f9", // ✅ พื้นหลังเหลืองอ่อนเมื่อใช้แต้ม
                    border: "1px solid #e0e0e0",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={chip(r.source)}>
                      {r.source === "web" ? "WEB" : r.source === "line" ? "LINE" : "MIXED"}
                    </span>
                    {r.usedPoint && <span style={pointChip}>ใช้แต้ม</span>}
                    <span style={{ fontWeight: 700, color: "#4f8cff" }}>{getBarberName(r.barber_id)}</span>
                  </div>
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

            <p><strong>ช่องทาง:</strong> {selectedReservation.source === "web" ? "เว็บ" : selectedReservation.source === "line" ? "ไลน์" : "ผสม"}</p>
            <p><strong>ชื่อ:</strong> {selectedReservation.customer_name}</p>
            <p><strong>เบอร์โทร:</strong> {selectedReservation.phone || "-"}</p>
            <p><strong>ช่าง:</strong> {getBarberName(selectedReservation.barber_id)}</p>
            <p><strong>เวลา:</strong> {selectedReservation.start_time}–{selectedReservation.end_time}</p>
            <p><strong>ระยะเวลา:</strong> {selectedReservation.total_hours} ชั่วโมง</p>
            <p><strong>หมายเหตุ:</strong> {selectedReservation.note || "-"}</p>

            {/* ✅ แสดงส่วนลดเมื่อใช้แต้ม */}
            {selectedReservation.usedPoint && (
              <div
                style={{
                  marginTop: 10,
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  color: "#92400e",
                  padding: "10px 12px",
                  borderRadius: 8,
                  fontWeight: 800,
                }}
              >
                ⭐ ใช้แต้ม: ลด 50% 
              </div>
            )}

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
                onClick={() => cancelReservation(selectedReservation.idTuples)}
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
