// app/home/Dashboard.tsx
"use client";

import React from "react";
import dayjs from "dayjs";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  database, ref, onValue, query, orderByChild, limitToLast
} from "../../lib/firebase";
import { onChildRemoved } from "firebase/database";

// ---------- Types ----------
interface Reservation {
  appointment_date: string;
  appointment_time: string;
  barber_id: string;
  customer_name: string;
  phone?: string;
  note?: string;
  created_at?: string;
  channel?: "web" | "line";
  source?: "web" | "line";
  via?: "web" | "line";
  status?: string;
  payment_status?: string;
  use_point?: boolean;            // ✅ ใช้แต้มสะสม (จาก LINE)
}
type ReservationWithId = Reservation & { id: string };

interface Barber { name: string }

type Payment = {
  date?: string;
  time?: string;
  barber?: string;
  barber_id?: string;
  status?: string;
  matched?: boolean;
  createdAt?: number;
  createdAtISO?: string;
  customerName?: string;
  payment_status?: string;
  use_point?: boolean;           // (เผื่อมีจากเว็บ)
};
type PaymentWithId = Payment & { id: string };

type UnifiedStatus = "confirmed" | "mismatch" | "pending" | "cancelled";

type UnifiedItem = {
  id: string;
  key: string;
  ts: number;
  source: "reservation" | "payment" | "reservation_removed";
  status: UnifiedStatus;
  date?: string;
  time?: string;
  barberId?: string;
  barberName?: string;
  customerName?: string;
  usedPoint?: boolean;           // ✅ ติดธงว่าใช้แต้ม
};

const COLORS = ['#f472b6', '#ec4899', '#fbbf24', '#38bdf8', '#a3e635', '#f87171', '#818cf8', '#facc15', '#34d399', '#fb7185'];

// ---------- Helpers ----------
const toLower = (s?: string) => (s || "").toLowerCase();
const boolish = (v: any) => v === true || v === "true" || v === 1 || v === "1";
const isCancelledWord = (s?: string) =>
  ["cancel", "cancelled", "canceled", "void", "refund", "refunded"].includes(toLower(s));
const isPaidWord = (s?: string) =>
  ["paid", "success", "completed", "confirmed"].includes(toLower(s));

type Props = {
  barbers: Record<string, Barber>;
  totalReservations: number;
  totalBarbers: number;
  dailySummary: any[];
  monthlySummary: any[];
  barberSummary: any[];
};

const DashboardPage: React.FC<Props> = ({
  barbers,
  totalReservations,
  totalBarbers,
  dailySummary,
  monthlySummary,
  barberSummary
}) => {
  const getBarberNameById = (id?: string) =>
    (id && barbers[id]?.name) || id || "ไม่ระบุช่าง";

  // ===== Realtime =====
  const [latestReservations, setLatestReservations] = React.useState<ReservationWithId[]>([]);
  const [latestPayments, setLatestPayments] = React.useState<PaymentWithId[]>([]);
  const [lineRemoved, setLineRemoved] = React.useState<ReservationWithId[]>([]);
  const [latestUnified, setLatestUnified] = React.useState<UnifiedItem[]>([]);

  React.useEffect(() => {
    const unsubRes = onValue(
      query(ref(database, "reservations"), orderByChild("created_at"), limitToLast(30)),
      (snap) => {
        const val = snap.val() || {};
        const arr: ReservationWithId[] = Object.entries(val).map(
          ([id, r]: [string, any]) => ({ id, ...(r as Reservation) })
        );
        setLatestReservations(arr);
      }
    );

    const unsubPay = onValue(
      query(ref(database, "payments"), orderByChild("createdAt"), limitToLast(30)),
      (snap) => {
        const val = snap.val() || {};
        const arr: PaymentWithId[] = Object.entries(val).map(
          ([id, p]: [string, any]) => ({ id, ...(p as Payment) })
        );
        setLatestPayments(arr);
      }
    );

    const unsubRemoved = onChildRemoved(ref(database, "reservations"), (snap) => {
      const removed: Reservation | null = (snap.val() as any) || null;
      if (!removed) return;
      const id = snap.key || "";
      const item: ReservationWithId = { id, ...removed };
      setLineRemoved(prev => [item, ...prev].slice(0, 30));
    });

    return () => { unsubRes(); unsubPay(); unsubRemoved(); };
  }, []);

  // map status
  const statusFromReservation = (r: Reservation): UnifiedStatus => {
    const s1 = r.status, s2 = r.payment_status;
    if (isCancelledWord(s1) || isCancelledWord(s2)) return "cancelled";
    if (toLower(s1) === "mismatch" || toLower(s2) === "mismatch") return "mismatch";
    if (isPaidWord(s1) || isPaidWord(s2)) return "confirmed";
    return "pending";
  };
  const statusFromPayment = (p: Payment): UnifiedStatus => {
    const s1 = p.status, s2 = p.payment_status;
    if (isCancelledWord(s1) || isCancelledWord(s2)) return "cancelled";
    if (p.matched === true || isPaidWord(s1) || isPaidWord(s2)) return "confirmed";
    if (p.matched === false || toLower(s1) === "mismatch" || toLower(s2) === "mismatch") return "mismatch";
    return "pending";
  };

  React.useEffect(() => {
    // RES
    const resItems: UnifiedItem[] = latestReservations.map((r) => {
      const ts = r.created_at
        ? new Date(r.created_at).getTime()
        : dayjs(`${r.appointment_date} ${r.appointment_time}`).valueOf();

      const barberName = getBarberNameById(r.barber_id);
      const barberKey = r.barber_id
        ? `ID:${r.barber_id}`
        : `NM:${(barberName || "").toUpperCase()}`;

      return {
        id: `RES_${r.id}`,
        key: `${r.appointment_date}|${r.appointment_time}|${barberKey}`,
        ts: Number.isFinite(ts) ? ts : Date.now(),
        source: "reservation",
        status: statusFromReservation(r),
        date: r.appointment_date,
        time: r.appointment_time,
        barberId: r.barber_id,
        barberName,
        customerName: r.customer_name,
        usedPoint: boolish((r as any).use_point),           // ✅
      };
    });

    // PAY
    const payItems: UnifiedItem[] = latestPayments.map((p) => {
      const ts =
        (typeof p.createdAt === "number" && p.createdAt) ||
        (p.createdAtISO ? new Date(p.createdAtISO).getTime() : undefined) ||
        dayjs(`${p.date ?? ""} ${p.time ?? ""}`).valueOf();

      const barberName = p.barber_id ? getBarberNameById(p.barber_id) : (p.barber || "ไม่ระบุช่าง");
      const barberKey = p.barber_id
        ? `ID:${p.barber_id}`
        : `NM:${(barberName || "").toUpperCase()}`;

      return {
        id: `PAY_${p.id}`,
        key: `${p.date ?? ""}|${p.time ?? ""}|${barberKey}`,
        ts: Number.isFinite(ts as number) ? (ts as number) : Date.now(),
        source: "payment",
        status: statusFromPayment(p),
        date: p.date,
        time: p.time,
        barberId: p.barber_id,
        barberName,
        customerName: p.customerName,
        usedPoint: boolish((p as any).use_point),           // ✅ (ถ้ามี)
      };
    });

    // RES_REMOVED
    const removedItems: UnifiedItem[] = lineRemoved.map((r) => {
      const ts = r.created_at
        ? new Date(r.created_at).getTime()
        : dayjs(`${r.appointment_date} ${r.appointment_time}`).valueOf();
      const barberName = getBarberNameById(r.barber_id);
      const barberKey = r.barber_id
        ? `ID:${r.barber_id}`
        : `NM:${(barberName || "").toUpperCase()}`;
      return {
        id: `RESDEL_${r.id}`,
        key: `${r.appointment_date}|${r.appointment_time}|${barberKey}`,
        ts: Number.isFinite(ts) ? ts : Date.now(),
        source: "reservation_removed",
        status: "cancelled",
        date: r.appointment_date,
        time: r.appointment_time,
        barberId: r.barber_id,
        barberName,
        customerName: r.customer_name,
        usedPoint: boolish((r as any).use_point),           // ✅
      };
    });

    // merge priority
    const score = (s: UnifiedStatus) =>
      s === "confirmed" ? 3 :
      s === "mismatch"  ? 2 :
      s === "pending"   ? 1 : 0;

    const map = new Map<string, UnifiedItem>();
    [...resItems, ...payItems, ...removedItems].forEach((item) => {
      if (!item.key.includes("|")) return;
      const prev = map.get(item.key);
      if (!prev) {
        map.set(item.key, item);
      } else {
        const prevScore = score(prev.status);
        const curScore  = score(item.status);
        if (curScore > prevScore || (curScore === prevScore && item.ts > prev.ts)) {
          map.set(item.key, item);
        }
        // ถ้าทั้งคู่มี key เดียวกัน ให้ preserve ธง usedPoint ถ้าอันใหม่หรืออันเก่ามี
        const merged = map.get(item.key)!;
        merged.usedPoint = (prev?.usedPoint || item.usedPoint) ? true : false;
        map.set(item.key, merged);
      }
    });

    const merged = Array.from(map.values())
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 10);

    setLatestUnified(merged);
  }, [latestReservations, latestPayments, lineRemoved, barbers]);

  // ===== ช่องทางการจอง (เว็บ/ไลน์)
  const [webCount, setWebCount] = React.useState(0);
  const [lineCount, setLineCount] = React.useState(0);

  React.useEffect(() => {
    const offPay = onValue(ref(database, "payments"), (snap) => {
      const v = snap.val() || {};
      setWebCount(Object.keys(v).length);
    });
    const offRes = onValue(ref(database, "reservations"), (snap) => {
      const v = snap.val() || {};
      setLineCount(Object.keys(v).length);
    });
    return () => { offPay(); offRes(); };
  }, []);

  const channelDonutData = React.useMemo(() => ([
    { name: "ผ่านเว็บ", value: webCount },
    { name: "ผ่านไลน์", value: lineCount },
  ]), [webCount, lineCount]);

  // ===== UI helpers =====
  const pillStyle = (status: UnifiedStatus) => {
    if (status === "confirmed") {
      return { bg: "#e8f7ee", fg: "#0f7a4b", bd: "#c8efd9", text: "ยืนยันแล้ว" };
    }
    if (status === "mismatch") {
      return { bg: "#fff6e6", fg: "#9a5b00", bd: "#ffd9a8", text: "ยอดไม่ตรง" };
    }
    if (status === "cancelled") {
      return { bg: "#fee2e2", fg: "#b91c1c", bd: "#fecaca", text: "ยกเลิกแล้ว" };
    }
    return { bg: "#eef2ff", fg: "#3730a3", bd: "#c7d2fe", text: "รอยืนยัน" };
  };
  const pointPill = { bg: "#fef3c7", fg: "#92400e", bd: "#fde68a", text: "ใช้แต้ม" }; // ✅ สีเหลือง

  // ===== Styles =====
  const pageWrap: React.CSSProperties = {
    minHeight: "calc(100vh - 0px)",
    width: "100%",
    background: "#f6f8fb",
    padding: "16px 16px 28px",
  };
  const gridSummary: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
    marginBottom: 18,
    width: "100%",
  };
  const cardSummary: React.CSSProperties = {
    borderRadius: 16,
    color: "#fff",
    padding: 24,
  };
  const rail: React.CSSProperties = { width: "100%", display: "grid", gap: 16 };
  const twoCol: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
    gap: 16,
    width: "100%",
  };
  const card: React.CSSProperties = {
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 4px 18px rgba(0,0,0,.05)",
    padding: 20,
    width: "100%",
  };

  return (
    <div style={pageWrap}>
      {/* สรุปบนสุด */}
      <div style={gridSummary}>
        <div style={{ ...cardSummary, background: "linear-gradient(135deg,#4f8cff 60%,#a5b4fc 100%)" }}>
          <div style={{ fontSize: 18, fontWeight: 700, opacity: .95 }}>การจองทั้งหมด</div>
          <div style={{ fontSize: 56, fontWeight: 900, marginTop: 8 }}>{totalReservations}</div>
        </div>
        <div style={{ ...cardSummary, background: "linear-gradient(135deg,#43e97b 60%,#38f9d7 100%)" }}>
          <div style={{ fontSize: 18, fontWeight: 700, opacity: .95 }}>จำนวนช่าง</div>
          <div style={{ fontSize: 56, fontWeight: 900, marginTop: 8 }}>{totalBarbers}</div>
        </div>
      </div>

      <div style={rail}>
        {/* การจองล่าสุด (รวม) */}
        <div style={card}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>การจองล่าสุด </h2>
          {latestUnified.length === 0 ? (
            <p>กำลังโหลด...</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {latestUnified.map((item, idx) => {
                const s = pillStyle(item.status);
                const rowBg = item.usedPoint ? "#fffbeb" : "transparent"; // ✅ พื้นหลังเหลืองอ่อนมาก
                return (
                  <li
                    key={item.id || idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 6px",
                      borderBottom: idx !== latestUnified.length - 1 ? "1px solid #f1f5f9" : "none",
                      background: rowBg,
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: 999,
                        background: s.bg, color: s.fg,
                        fontWeight: 700, fontSize: 13, border: `1px solid ${s.bd}`
                      }}>
                        {s.text}
                      </span>

                      {/* ✅ ป้าย "ใช้แต้ม" สีเหลือง */}
                      {item.usedPoint && (
                        <span style={{
                          padding: "4px 10px", borderRadius: 999,
                          background: pointPill.bg, color: pointPill.fg,
                          fontWeight: 800, fontSize: 13, border: `1px solid ${pointPill.bd}`
                        }}>
                          {pointPill.text}
                        </span>
                      )}

                      <span style={{ fontWeight: 700, color: "#4f8cff" }}>{item.barberName || "ไม่ระบุช่าง"}</span>
                      <span style={{ color: "#475569" }}>{item.customerName || "-"}</span>
                    </div>
                    <div style={{ color: "#22223b", fontWeight: 600, minWidth: 160, textAlign: "right" }}>
                      {(item.date ? dayjs(item.date).format("DD/MM/YYYY") : "")} {item.time || ""}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* กราฟสองคอลัมน์ */}
        <div style={twoCol}>
          <div style={card}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>สรุปการจองรายวัน</h2>
            <div style={{ width: "100%", height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySummary}>
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#ec4899" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={card}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>สรุปการจองแยกตามช่าง</h2>
            <div style={{ width: "100%", height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={barberSummary}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  >
                    {barberSummary.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* โดนัท ช่องทางการจอง */}
        <div style={card}>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>ช่องทางการจอง (เว็บ / ไลน์)</h2>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={channelDonutData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={120}
                  label={({ name, value }) => `${name}: ${value} คน`}
                >
                  <Cell fill="#f472b6" /> {/* ผ่านเว็บ (payments) */}
                  <Cell fill="#38bdf8" /> {/* ผ่านไลน์ (reservations) */}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
