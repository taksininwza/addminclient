"use client";
import React, { useEffect, useState } from "react";
import { database, ref, onValue, set, remove, push } from "../lib/firebase";
import Calendar from "react-calendar";
import dayjs from "dayjs";
import "react-calendar/dist/Calendar.css";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useRouter } from "next/navigation";

// อินเทอร์เฟซ
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

const COLORS = ['#f472b6', '#ec4899', '#fbbf24', '#38bdf8', '#a3e635', '#f87171', '#818cf8', '#facc15', '#34d399', '#fb7185'];

const HomePage: React.FC = () => {
  const [reservations, setReservations] = useState<Record<string, Reservation>>({});
  const [barbers, setBarbers] = useState<Record<string, Barber>>({});
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedBarber, setSelectedBarber] = useState<string>("");
  const [newBarberName, setNewBarberName] = useState<string>("");
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [page, setPage] = useState<"dashboard" | "calendar">("dashboard");
  const [dailySummary, setDailySummary] = useState<any[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<any[]>([]);
  const [barberSummary, setBarberSummary] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const resRef = ref(database, "reservations");
    const unsubscribe = onValue(resRef, (snapshot) => {
      setReservations(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const barberRef = ref(database, "barbers");
    const unsubscribe = onValue(barberRef, (snapshot) => {
      setBarbers(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // สรุปข้อมูลสำหรับ dashboard กราฟ
    const barbersMap: Record<string, string> = {};
    Object.entries(barbers).forEach(([id, val]) => {
      barbersMap[id] = val.name;
    });
    const data = Object.values(reservations);

    const daily: Record<string, number> = {};
    const monthly: Record<string, number> = {};
    const barberCount: Record<string, number> = {};

    data.forEach((b: any) => {
      if (!b.appointment_date) return;
      const date = dayjs(b.appointment_date).format('YYYY-MM-DD');
      const month = dayjs(b.appointment_date).format('YYYY-MM');
      daily[date] = (daily[date] || 0) + 1;
      monthly[month] = (monthly[month] || 0) + 1;
      if (b.barber_id) {
        const barberName = barbersMap?.[b.barber_id] || b.barber_id;
        barberCount[barberName] = (barberCount[barberName] || 0) + 1;
      }
    });

    setDailySummary(
      Object.entries(daily).map(([date, count]) => ({
        date: dayjs(date).format('D MMM'),
        count,
      }))
    );
    setMonthlySummary(
      Object.entries(monthly).map(([month, count]) => ({
        month: dayjs(month).format('MMM YYYY'),
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

  const getReservationsForDateAndBarber = (date: Date, barberId: string): Reservation[] => {
    const formatted = dayjs(date).format("YYYY-MM-DD");
    return Object.values(reservations).filter(
      (res) =>
        res.appointment_date === formatted &&
        (barberId === "" || res.barber_id === barberId)
    );
  };

  const selectedReservations = getReservationsForDateAndBarber(selectedDate, selectedBarber).sort(
    (a, b) => {
      const timeA = a.appointment_time.split(":").map(Number);
      const timeB = b.appointment_time.split(":").map(Number);
      return timeA[0] - timeB[0] || timeA[1] - timeB[1];
    }
  );

  const addBarber = () => {
    if (!newBarberName.trim()) return;
    const barberRef = ref(database, "barbers");
    const newBarberRef = push(barberRef);
    set(newBarberRef, { name: newBarberName.trim() });
    setNewBarberName("");
  };

  const deleteBarber = (barberId: string) => {
    if (!window.confirm("ยืนยันการลบช่างนี้?")) return;
    remove(ref(database, `barbers/${barberId}`));
  };

  const getBarberName = (id: string) => barbers[id]?.name || id || "ไม่ระบุช่าง";

  // Dashboard summary
  const totalReservations = Object.values(reservations).length;
  const totalBarbers = Object.keys(barbers).length;
  const latestReservations = Object.values(reservations)
    .sort((a, b) => {
      const dA = dayjs(`${a.appointment_date} ${a.appointment_time}`);
      const dB = dayjs(`${b.appointment_date} ${b.appointment_time}`);
      return dB.valueOf() - dA.valueOf();
    })
    .slice(0, 5);

  const handleLogout = () => {
    localStorage.removeItem("isAdmin");
    router.push("/login");
  };

  return (
    <div style={{
      padding: 0,
      fontFamily: "sans-serif",
      maxWidth: 1000,
      margin: "auto",
      background: "#f6f8fa",
      minHeight: "100vh"
    }}>
      {/* Navigation Bar */}
      <nav style={{
        background: "#22223b",
        color: "#fff",
        padding: "18px 30px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderRadius: "0 0 16px 16px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
      }}>
        <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: 1 }}>
          💈 Addmin Barber
        </div>
        <div>
          <button
            onClick={() => setPage("dashboard")}
            style={{
              background: page === "dashboard" ? "#4f8cff" : "transparent",
              color: page === "dashboard" ? "#fff" : "#bfc7d1",
              border: "none",
              borderRadius: 8,
              padding: "8px 18px",
              marginRight: 10,
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 16,
              transition: "background 0.2s"
            }}
          >
            Dashboard
          </button>
          <button
            onClick={() => setPage("calendar")}
            style={{
              background: page === "calendar" ? "#4f8cff" : "transparent",
              color: page === "calendar" ? "#fff" : "#bfc7d1",
              border: "none",
              borderRadius: 8,
              padding: "8px 18px",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 16,
              transition: "background 0.2s",
              marginRight: 10
            }}
          >
            Calendar
          </button>
          <button
            onClick={handleLogout}
            style={{
              background: "#e63946",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 8px",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 16,
              transition: "background 0.2s"
            }}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div style={{ padding: 32 }}>
        {page === "dashboard" ? (
          // DASHBOARD PAGE
          <div>
            
            <div style={{
              display: "flex",
              gap: 32,
              marginBottom: 32,
              flexWrap: "wrap"
            }}>
              <div style={{
                flex: 1,
                minWidth: 220,
                background: "linear-gradient(135deg, #4f8cff 60%, #a5b4fc 100%)",
                color: "#fff",
                borderRadius: 14,
                padding: 28,
                boxShadow: "0 2px 12px rgba(79,140,255,0.08)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center"
              }}>
                <div style={{ fontSize: 22, fontWeight: 600 }}>การจองทั้งหมด</div>
                <div style={{ fontSize: 48, fontWeight: 800, margin: "12px 0" }}>{totalReservations}</div>
              </div>
              <div style={{
                flex: 1,
                minWidth: 220,
                background: "linear-gradient(135deg, #43e97b 60%, #38f9d7 100%)",
                color: "#fff",
                borderRadius: 14,
                padding: 28,
                boxShadow: "0 2px 12px rgba(67,233,123,0.08)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center"
              }}>
                <div style={{ fontSize: 22, fontWeight: 600 }}>จำนวนช่าง</div>
                <div style={{ fontSize: 48, fontWeight: 800, margin: "12px 0" }}>{totalBarbers}</div>
              </div>
            </div>
            <div style={{
              background: "#fff",
              borderRadius: 12,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              padding: 24,
              marginTop: 12
            }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 18 }}>การจองล่าสุด</h2>
              {latestReservations.length > 0 ? (
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {latestReservations.map((res, idx) => (
                    <li key={idx} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 0",
                      borderBottom: idx !== latestReservations.length - 1 ? "1px solid #f0f0f0" : "none"
                    }}>
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
          </div>
        ) : (
          // CALENDAR PAGE
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: "#22223b", marginBottom: 24 }}>
              📅 ปฏิทินการจอง
            </h1>
            {/* เพิ่มช่าง */}
            <div style={{
              marginBottom: 24,
              display: "flex",
              gap: 12,
              alignItems: "center"
            }}>
              <input
                type="text"
                placeholder="ชื่อช่างใหม่"
                value={newBarberName}
                onChange={(e) => setNewBarberName(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #cfd8dc",
                  fontSize: 16,
                  outline: "none",
                  flex: "0 0 220px"
                }}
              />
              <button
                onClick={addBarber}
                style={{
                  padding: "8px 18px",
                  background: "#43e97b",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 16,
                  cursor: "pointer",
                  boxShadow: "0 1px 4px rgba(67,233,123,0.08)"
                }}
              >
                เพิ่มช่าง
              </button>
            </div>

            {/* รายชื่อช่าง */}
            <div style={{
              marginBottom: 18,
              background: "#fff",
              borderRadius: 10,
              padding: 18,
              boxShadow: "0 1px 6px rgba(0,0,0,0.04)"
            }}>
              <h3 style={{ margin: 0, marginBottom: 10, color: "#22223b" }}>รายชื่อช่าง</h3>
              <ul style={{ paddingLeft: 0, marginBottom: 12 }}>
                {Object.entries(barbers).map(([id, barber]) => (
                  <li key={id} style={{
                    listStyle: "none",
                    marginBottom: 6,
                    display: "flex",
                    justifyContent: "space-between",
                    backgroundColor: "#f0f4f8",
                    padding: "8px 16px",
                    borderRadius: 8,
                    alignItems: "center"
                  }}>
                    <span style={{ fontWeight: 500 }}>{barber.name}</span>
                    <button
                      onClick={() => deleteBarber(id)}
                      style={{
                        color: "#fff",
                        backgroundColor: "#e63946",
                        border: "none",
                        borderRadius: 6,
                        padding: "6px 14px",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 14
                      }}
                    >
                      ลบ
                    </button>
                  </li>
                ))}
              </ul>
              <label style={{ fontWeight: 500 }}>
                เลือกช่าง:{" "}
                <select
                  value={selectedBarber}
                  onChange={(e) => setSelectedBarber(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #cfd8dc",
                    fontSize: 15,
                    marginLeft: 8
                  }}
                >
                  <option value="">ทั้งหมด</option>
                  {Object.entries(barbers).map(([id, barber]) => (
                    <option key={id} value={id}>{barber.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
              {/* ปฏิทิน */}
              <div style={{
                flex: 1,
                minWidth: 320,
                maxWidth: 420,
                background: "#fff",
                borderRadius: 12,
                boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
                padding: 18
              }}>
                <Calendar
                  value={selectedDate}
                  onChange={(value) => setSelectedDate(value as Date)}
                  tileContent={({ date }) => {
                    const count = getReservationsForDateAndBarber(date, selectedBarber).length;
                    return count > 0 ? (
                      <div style={{
                        fontSize: "0.7em",
                        color: "white",
                        background: "#4caf50",
                        borderRadius: "5px",
                        padding: "2px",
                        marginTop: 2
                      }}>
                        {count} รายการ
                      </div>
                    ) : null;
                  }}
                />
              </div>

              {/* การจอง */}
              <div style={{
                flex: 1,
                minWidth: 320,
                maxHeight: 480,
                overflowY: "auto",
                border: "1px solid #e0e0e0",
                borderRadius: 12,
                padding: 20,
                backgroundColor: "#fff",
                boxShadow: "0 1px 8px rgba(0,0,0,0.04)"
              }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#22223b" }}>
                  การจองวันที่ {dayjs(selectedDate).format("DD/MM/YYYY")}
                </h2>
                {selectedReservations.length > 0 ? (
                  <ul style={{ listStyle: "none", padding: 0, marginTop: 10 }}>
                    {selectedReservations.map((res, idx) => (
                      <li
                        key={idx}
                        onClick={() => setSelectedReservation(res)}
                        style={{
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 18px",
                          marginBottom: 10,
                          borderRadius: 10,
                          background: "#f9f9f9",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                          fontSize: 15,
                          transition: "background 0.2s",
                          border: "1px solid #e0e0e0"
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "#4f8cff" }}>{getBarberName(res.barber_id)}</div>
                        <div>🧑 {res.customer_name} <span style={{ color: "#43e97b", fontWeight: 600 }}>⏰ {res.appointment_time}</span></div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>ไม่มีการจอง</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL */}
      {selectedReservation && (
        <div
          onClick={() => setSelectedReservation(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "white",
              padding: 28,
              borderRadius: 14,
              maxWidth: 420,
              width: "90%",
              boxShadow: "0 2px 16px rgba(0,0,0,0.13)"
            }}
          >
            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 18 }}>📋 รายละเอียดการจอง</h3>
            <p><strong>ชื่อ:</strong> {selectedReservation.customer_name}</p>
            <p><strong>เบอร์โทร:</strong> {selectedReservation.phone || "-"}</p>
            <p><strong>ช่าง:</strong> {getBarberName(selectedReservation.barber_id)}</p>
            <p><strong>เวลา:</strong> {selectedReservation.appointment_time}</p>
            <p><strong>หมายเหตุ:</strong> {selectedReservation.note || "-"}</p>
            <button
              onClick={() => setSelectedReservation(null)}
              style={{
                marginTop: 18,
                padding: "8px 18px",
                backgroundColor: "#4f8cff",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 16,
                cursor: "pointer"
              }}
            >
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* DASHBOARD CHARTS: show only on dashboard page */}
      {page === "dashboard" && (
        <div className="bg-pink-100 w-full px-0 py-10 mt-10" style={{ fontFamily: "inherit" }}>
          <div className="max-w-5xl mx-auto mb-10">
            <div className="flex flex-col md:flex-row gap-8">
              {/* รายวัน */}
              <div className="flex-1">
                <h2 className="text-2xl font-semibold mb-4">สรุปการจองรายวัน</h2>
                <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
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
                <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={barberSummary}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {barberSummary.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
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
            <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 8px rgba(0,0,0,0.04)", width: "100%", maxWidth: 600, margin: "auto" }}>
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
      )}
    </div>
  );
};

export default HomePage;
