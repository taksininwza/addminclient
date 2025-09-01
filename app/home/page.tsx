// app/home/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import Link from "next/link";
import { database, ref, onValue, set, remove, push } from "../../lib/firebase";
import DashboardPage from "./Dashboard";
import CalendarPage from "./Calendar";
import BarbersPage from "./Barbers";
import AdminHomeContent from "./AdminHomeContent"; // ✅ เพิ่ม

interface Reservation {
  appointment_date: string;
  appointment_time: string;
  barber_id: string;
  customer_name: string;
  phone?: string;
  note?: string;
}
interface Barber { name: string }

const HomePage: React.FC = () => {
  const [page, setPage] = useState<"dashboard" | "calendar" | "barbers" | "homeContent">("dashboard"); // ✅ เพิ่ม "homeContent"
  const [reservations, setReservations] = useState<Record<string, Reservation>>({});
  const [barbers, setBarbers] = useState<Record<string, Barber>>({});
  const [dailySummary, setDailySummary] = useState<any[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<any[]>([]);
  const [barberSummary, setBarberSummary] = useState<any[]>([]);

  // ====== styles (responsive container) ======
  const container: React.CSSProperties = {
    width: "100%",
    maxWidth: "min(1200px, 92vw)",
    margin: "0 auto",
    padding: "clamp(12px, 3vw, 24px)",
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: active ? "#4f8cff" : "transparent",
    color: active ? "#fff" : "#bfc7d1",
    border: "1px solid rgba(255,255,255,.15)",
    borderRadius: 8,
    padding: "8px 14px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    textDecoration: "none",
    display: "inline-block",
  });

  // fetch data
  useEffect(() => {
    const unsubRes = onValue(ref(database, "reservations"), (s) =>
      setReservations(s.val() || {})
    );
    const unsubBar = onValue(ref(database, "barbers"), (s) =>
      setBarbers(s.val() || {})
    );
    return () => { unsubRes(); unsubBar(); };
  }, []);

  // summaries สำหรับกราฟใน Dashboard
  useEffect(() => {
    const id2name: Record<string, string> = {};
    Object.entries(barbers).forEach(([id, v]) => (id2name[id] = v.name));

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
        const name = id2name[b.barber_id] || b.barber_id;
        barberCount[name] = (barberCount[name] || 0) + 1;
      }
    });

    setDailySummary(Object.entries(daily).map(([date, count]) => ({
      date: dayjs(date).format("D MMM"), count,
    })));
    setMonthlySummary(Object.entries(monthly).map(([month, count]) => ({
      month: dayjs(month).format("MMM YYYY"), count,
    })));
    setBarberSummary(Object.entries(barberCount).map(([name, count]) => ({
      name, count,
    })));
  }, [reservations, barbers]);

  const totalReservations = Object.values(reservations).length;
  const totalBarbers = Object.keys(barbers).length;

  // add / delete barber
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

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        background: "#f6f8fa",
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Arial, sans-serif",
        overflowX: "hidden",
      }}
    >
      {/* Nav */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "#22223b",
          color: "#fff",
          borderBottom: "1px solid #2e335a",
        }}
      >
        <div
          style={{
            ...container,
            paddingTop: "12px",
            paddingBottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: .2 }}>
             Admin
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
           
            <button onClick={() => setPage("dashboard")} style={tabStyle(page === "dashboard")}>
              Dashboard
            </button>
            <button onClick={() => setPage("calendar")} style={tabStyle(page === "calendar")}>
              Calendar
            </button>
            <button onClick={() => setPage("barbers")} style={tabStyle(page === "barbers")}>
              Barbers
            </button>
            {/* ✅ ปุ่มใหม่: จัดการหน้า Home */}
            <button onClick={() => setPage("homeContent")} style={tabStyle(page === "homeContent")}>
              Edit Home
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
                whiteSpace: "nowrap",
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ width: "100%" }}>
        <div style={container}>
          {page === "dashboard" ? (
            <DashboardPage
              barbers={barbers}
              totalReservations={totalReservations}
              totalBarbers={totalBarbers}
              dailySummary={dailySummary}
              monthlySummary={monthlySummary}
              barberSummary={barberSummary}
            />
          ) : page === "calendar" ? (
            <CalendarPage reservations={reservations} barbers={barbers} />
          ) : page === "barbers" ? (
            <BarbersPage barbers={barbers} addBarber={addBarber} deleteBarber={deleteBarber} />
          ) : (
            <AdminHomeContent /> // ✅ หน้าจัดการโปรโมชั่น/รีวิว
          )}
        </div>
      </main>
    </div>
  );
};

export default HomePage;
