// app/home/page.tsx
"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { database, ref, onValue, set, remove, push } from "../../lib/firebase";
import DashboardPage from "./Dashboard";
import CalendarPage from "./Calendar";
import BarbersPage from "./Barbers"; // ใช้เป็น component (ไม่ใช่ route)

interface Reservation {
  appointment_date: string;
  appointment_time: string;
  barber_id: string;
  customer_name: string;
  phone?: string;
  note?: string;
}
interface Barber {
  name: string;
}

const HomePage: React.FC = () => {
  const router = useRouter();
  const [page, setPage] = useState<"dashboard" | "calendar" | "barbers">("dashboard");
  const [reservations, setReservations] = useState<Record<string, Reservation>>({});
  const [barbers, setBarbers] = useState<Record<string, Barber>>({});
  const [dailySummary, setDailySummary] = useState<any[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<any[]>([]);
  const [barberSummary, setBarberSummary] = useState<any[]>([]);

  // ปุ่มแท็บให้หน้าตาเหมือนกันทุกอัน
  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: active ? "#4f8cff" : "transparent",
    color: active ? "#fff" : "#bfc7d1",
    border: "none",
    borderRadius: 8,
    padding: "8px 18px",
    cursor: "pointer",
  });

  // fetch data
  useEffect(() => {
    const unsubRes = onValue(ref(database, "reservations"), (s) =>
      setReservations(s.val() || {})
    );
    const unsubBar = onValue(ref(database, "barbers"), (s) =>
      setBarbers(s.val() || {})
    );
    return () => {
      unsubRes();
      unsubBar();
    };
  }, []);

  // summaries สำหรับกราฟใน Dashboard
  useEffect(() => {
    const map: Record<string, string> = {};
    Object.entries(barbers).forEach(([id, v]) => (map[id] = v.name));

    const daily: Record<string, number> = {};
    const monthly: Record<string, number> = {};
    const barberCount: Record<string, number> = {};

    Object.values(reservations).forEach((b: any) => {
      if (!b.appointment_date) return;
      const d = dayjs(b.appointment_date).format("YYYY-MM-DD");
      const m = dayjs(b.appointment_date).format("YYYY-MM");
      daily[d] = (daily[d] || 0) + 1;
      monthly[m] = (monthly[m] || 0) + 1;
      if (b.barber_id) {
        const name = map[b.barber_id] || b.barber_id;
        barberCount[name] = (barberCount[name] || 0) + 1;
      }
    });

    setDailySummary(
      Object.entries(daily).map(([date, count]) => ({
        date: dayjs(date).format("D MMM"),
        count,
      }))
    );
    setMonthlySummary(
      Object.entries(monthly).map(([month, count]) => ({
        month: dayjs(month).format("MMM YYYY"),
        count,
      }))
    );
    setBarberSummary(
      Object.entries(barberCount).map(([name, count]) => ({
        name,
        count,
      }))
    );
  }, [reservations, barbers]);

  const totalReservations = Object.values(reservations).length;
  const totalBarbers = Object.keys(barbers).length;

  // ✅ การจองล่าสุดตาม "ลำดับการจองจริง" (อิง push key ใหม่สุดก่อน)
  const latestReservations: Reservation[] = Object.entries(reservations)
    .sort(([ka], [kb]) => kb.localeCompare(ka)) // key ใหม่ล่าสุดมาก่อน
    .slice(0, 5)
    .map(([, r]) => r);

  // เพิ่ม/ลบช่าง (ใช้ในหน้า Barbers)
  const addBarber = async (name: string) => {
    const n = name.trim();
    if (!n) return;
    const newRef = push(ref(database, "barbers"));
    await set(newRef, { name: n });
  };

  const deleteBarber = async (id: string) => {
    if (!window.confirm("ยืนยันการลบช่างนี้?")) return;
    await remove(ref(database, `barbers/${id}`));
  };

  // logout
  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div
      style={{
        padding: 0,
        fontFamily: "sans-serif",
        maxWidth: 1000,
        margin: "auto",
        background: "#f6f8fa",
        minHeight: "100vh",
      }}
    >
      {/* Nav */}
      <nav
        style={{
          background: "#22223b",
          color: "#fff",
          padding: "18px 30px",
          display: "flex",
          justifyContent: "space-between",
          borderRadius: "0 0 16px 16px",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 22 }}>💈 Addmin Barber</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => setPage("dashboard")} style={tabStyle(page === "dashboard")}>
            Dashboard
          </button>
          <button onClick={() => setPage("calendar")} style={tabStyle(page === "calendar")}>
            Calendar
          </button>
          <button onClick={() => setPage("barbers")} style={tabStyle(page === "barbers")}>
            Barbers
          </button>
          <button
            onClick={handleLogout}
            style={{
              background: "#e63946",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </nav>

      <div style={{ padding: 32 }}>
        {page === "dashboard" ? (
          <DashboardPage
            barbers={barbers}
            latestReservations={latestReservations} // ✅ ส่งตามลำดับการจองจริง
            totalReservations={totalReservations}
            totalBarbers={totalBarbers}
            dailySummary={dailySummary}
            monthlySummary={monthlySummary}
            barberSummary={barberSummary}
          />
        ) : page === "calendar" ? (
          <CalendarPage reservations={reservations} barbers={barbers} />
        ) : (
          <BarbersPage barbers={barbers} addBarber={addBarber} deleteBarber={deleteBarber} />
        )}
      </div>
    </div>
  );
};

export default HomePage;
