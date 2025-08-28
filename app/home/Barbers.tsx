// app/home/Barbers.tsx
"use client";
import React, { useState } from "react";

interface Barber { name: string }
type Props = {
  barbers: Record<string, Barber>;
  addBarber: (name: string) => void | Promise<void>;
  deleteBarber: (id: string) => void | Promise<void>;
};

const BarbersPage: React.FC<Props> = ({ barbers, addBarber, deleteBarber }) => {
  const [newBarberName, setNewBarberName] = useState("");

  const totalBarbers = Object.keys(barbers).length;

  return (
    <div>
      {/* การ์ดสรุป (ให้โทนเดียวกับ Dashboard) */}
      <div style={{ display: "flex", gap: 32, marginBottom: 32, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220, background: "linear-gradient(135deg, #43e97b 60%, #38f9d7 100%)", color: "#fff", borderRadius: 14, padding: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 600 }}>จำนวนช่างทั้งหมด</div>
          <div style={{ fontSize: 48, fontWeight: 800, margin: "12px 0" }}>{totalBarbers}</div>
        </div>
      </div>

      {/* เพิ่มช่าง */}
      <div style={{ marginBottom: 24, display: "flex", gap: 12, alignItems: "center" }}>
        <input
          type="text"
          placeholder="ชื่อช่างใหม่"
          value={newBarberName}
          onChange={(e) => setNewBarberName(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #cfd8dc", fontSize: 16, outline: "none", flex: "0 0 260px", background: "#fff" }}
        />
        <button
          onClick={async () => {
            const n = newBarberName.trim();
            if (!n) return;
            await addBarber(n);
            setNewBarberName("");
          }}
          style={{ padding: "10px 18px", background: "#22c55e", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
        >
          เพิ่มช่าง
        </button>
      </div>

      {/* รายชื่อช่าง (การ์ดเหมือนในโปรเจ็กต์) */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
        <h3 style={{ margin: 0, marginBottom: 10, color: "#22223b" }}>รายชื่อช่าง</h3>
        <ul style={{ listStyle: "none", paddingLeft: 0, marginBottom: 12 }}>
          {Object.entries(barbers).length === 0 && <p>ยังไม่มีรายชื่อช่าง</p>}
          {Object.entries(barbers).map(([id, barber]) => (
            <li
              key={id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#f0f4f8",
                padding: "10px 16px",
                borderRadius: 10,
                marginBottom: 8
              }}
            >
              <span style={{ fontWeight: 600 }}>{barber.name}</span>
              <button
                onClick={async () => {
                  if (!confirm("ยืนยันการลบช่างนี้?")) return;
                  await deleteBarber(id);
                }}
                style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer" }}
              >
                ลบ
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default BarbersPage;
