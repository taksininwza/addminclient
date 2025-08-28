// app/admin/dashboard/page.tsx  (ปรับ path ตามโปรเจกต์คุณ)
"use client";

import React from "react";
import dayjs from "dayjs";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, Legend
} from "recharts";

import { database, ref, onValue, query, orderByChild, limitToLast } from "../../lib/firebase";
// ถ้า lib เป็น .js (ไม่มี type) ให้ import type ตรงจาก SDK:
import type { DataSnapshot } from "firebase/database";


interface Reservation {
  appointment_date: string;
  appointment_time: string;
  barber_id: string;
  customer_name: string;
  phone?: string;
  note?: string;
  created_at?: string; // ใช้เรียงล่าสุด
}
type ReservationWithId = Reservation & { id: string };
interface Barber { name: string }

const COLORS = ['#f472b6', '#ec4899', '#fbbf24', '#38bdf8', '#a3e635', '#f87171', '#818cf8', '#facc15', '#34d399', '#fb7185'];

type Props = {
  barbers: Record<string, Barber>;
  // (ยังรับได้ เผื่อส่วนอื่นใช้ แต่ "การจองล่าสุด" จะไม่ใช้ prop นี้)
  latestReservations?: Reservation[];
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

  const getBarberName = (id: string) => barbers[id]?.name || id || "ไม่ระบุช่าง";

  // ===== 🔴 Realtime latest reservations =====
  const [latestRT, setLatestRT] = React.useState<ReservationWithId[] | null>(null);

  React.useEffect(() => {
    // เอา 10 รายการสุดท้ายตาม created_at
    const q = query(ref(database, "reservations"), orderByChild("created_at"), limitToLast(10));
    const off = onValue(q, (snap) => {
      const val = snap.val() || {};
      const arr: ReservationWithId[] = Object.entries(val).map(
        ([id, r]: [string, any]) => ({ id, ...(r as Reservation) })
      );
      // เรียงให้ "ล่าสุดอยู่บน"
      arr.sort((a, b) => ((a.created_at || "") < (b.created_at || "")) ? 1 : -1);
      setLatestRT(arr);
    });
    return () => off();
  }, []);

  return (
    <div>
      {/* การ์ดสรุป */}
      <div style={{ display: "flex", gap: 32, marginBottom: 32, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220, background: "linear-gradient(135deg, #4f8cff 60%, #a5b4fc 100%)", color: "#fff", borderRadius: 14, padding: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 600 }}>การจองทั้งหมด</div>
          <div style={{ fontSize: 48, fontWeight: 800, margin: "12px 0" }}>{totalReservations}</div>
        </div>
        <div style={{ flex: 1, minWidth: 220, background: "linear-gradient(135deg, #43e97b 60%, #38f9d7 100%)", color: "#fff", borderRadius: 14, padding: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 600 }}>จำนวนช่าง</div>
          <div style={{ fontSize: 48, fontWeight: 800, margin: "12px 0" }}>{totalBarbers}</div>
        </div>
      </div>

      {/* การจองล่าสุด (Realtime) */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 24, marginTop: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 18 }}>การจองล่าสุด</h2>

        {latestRT === null ? (
          <p>กำลังโหลด...</p>
        ) : latestRT.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {latestRT.map((res, idx) => (
              <li
                key={res.id || idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 0",
                  borderBottom: idx !== latestRT.length - 1 ? "1px solid #f0f0f0" : "none"
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: "#4f8cff" }}>{getBarberName(res.barber_id)}</span>
                  <span style={{ marginLeft: 10 }}>{res.customer_name}</span>
                </div>
                <div style={{ color: "#22223b", fontWeight: 500 }}>
                  {dayjs(res.appointment_date).format("DD/MM/YYYY")} {res.appointment_time}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>ไม่มีข้อมูลการจอง</p>
        )}
      </div>

      {/* กราฟ */}
      <div className="bg-pink-100 w-full px-0 py-10 mt-10" style={{ fontFamily: "inherit" }}>
        <div className="max-w-5xl mx-auto mb-10">
          <div className="flex flex-col md:flex-row gap-8">
            {/* รายวัน */}
            <div className="flex-1">
              <h2 className="text-2xl font-semibold mb-4">สรุปการจองรายวัน</h2>
              <div style={{ background: "#fff", borderRadius: 12, padding: 16 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailySummary}>
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#ec4899" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* รายช่าง */}
            <div className="flex-1">
              <h2 className="text-2xl font-semibold mb-4">สรุปการจองแยกตามช่าง</h2>
              <div style={{ background: "#fff", borderRadius: 12, padding: 16 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={barberSummary}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
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
        </div>

        {/* รายเดือน */}
        <div className="max-w-5xl mx-auto mb-10">
          <h2 className="text-2xl font-semibold mb-4">สรุปการจองรายเดือน</h2>
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, width: "100%", maxWidth: 600, margin: "auto" }}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlySummary}>
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
