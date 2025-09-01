// app/home/AdminHomeContent.tsx
"use client";

import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import { database, ref, onValue, set } from "@/lib/firebase";

type Promo = {
  title: string;
  subtitle?: string;
  discountPercent?: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  active: boolean;    // <<< ใช้เป็น boolean ล้วน
  imageUrl?: string;
};

const normalizeISO = (s?: string) => {
  if (!s) return "";
  const fmts = ["YYYY-MM-DD", "DD/MM/YYYY", "YYYY/MM/DD"];
  for (const f of fmts) {
    const d = dayjs(s, f, true);
    if (d.isValid()) return d.format("YYYY-MM-DD");
  }
  const d2 = dayjs(s);
  return d2.isValid() ? d2.format("YYYY-MM-DD") : "";
};

// แปลงค่าทุกแบบให้เป็น boolean
const toBool = (v: any) => v === true || v === "true" || v === 1 || v === "1";

export default function AdminHomeContent() {
  const [promo, setPromo] = useState<Promo>({
    title: "",
    subtitle: "",
    discountPercent: undefined,
    startDate: "",
    endDate: "",
    active: false,
    imageUrl: "/pic.jpg",
  });

  const path = "home/promotion";

  useEffect(() => {
    const unsub = onValue(ref(database, path), (snap) => {
      const raw = (snap.val() || {}) as any;

      const norm: Promo = {
        title: raw.title ?? "",
        subtitle: raw.subtitle ?? "",
        discountPercent:
          typeof raw.discountPercent === "number"
            ? raw.discountPercent
            : Number(raw.discountPercent) || undefined,
        startDate: normalizeISO(raw.startDate),
        endDate: normalizeISO(raw.endDate),
        active: toBool(raw.active),                 // <<< normalize เป็น boolean ตรงนี้
        imageUrl: raw.imageUrl || "/pic.jpg",
      };

      setPromo(norm);
    });
    return () => unsub();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Promo = {
      ...promo,
      startDate: normalizeISO(promo.startDate),
      endDate: normalizeISO(promo.endDate),
      active: !!promo.active,                       // <<< เก็บเป็น boolean เสมอ
    };
    await set(ref(database, path), payload);
    alert("บันทึกแล้ว");
  };

  return (
    <form onSubmit={save} style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 16 }}>🎉 โปรโมชันหน้า Home</h1>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>หัวข้อ</label>
        <input
          value={promo.title}
          onChange={(e) => setPromo((p) => ({ ...p, title: e.target.value }))}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
          required
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>รายละเอียด</label>
        <input
          value={promo.subtitle || ""}
          onChange={(e) => setPromo((p) => ({ ...p, subtitle: e.target.value }))}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>ส่วนลด (%)</label>
        <input
          type="number"
          min={0}
          max={100}
          value={promo.discountPercent ?? ""}
          onChange={(e) =>
            setPromo((p) => ({
              ...p,
              discountPercent: e.target.value ? Number(e.target.value) : undefined,
            }))
          }
          style={{ width: 160, padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>เริ่มวันที่</label>
          <input
            type="date"
            value={promo.startDate || ""}
            onChange={(e) => setPromo((p) => ({ ...p, startDate: e.target.value }))}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
          />
        </div>
        <div>
          <label style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>สิ้นสุดวันที่</label>
          <input
            type="date"
            value={promo.endDate || ""}
            onChange={(e) => setPromo((p) => ({ ...p, endDate: e.target.value }))}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>รูปโปรโมชัน (URL)</label>
        <input
          value={promo.imageUrl || ""}
          onChange={(e) => setPromo((p) => ({ ...p, imageUrl: e.target.value }))}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
          placeholder="/pic.jpg หรือ https://..."
        />
      </div>

      <div style={{ margin: "10px 0 18px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={promo.active}                             
            onChange={(e) => setPromo((p) => ({ ...p, active: e.target.checked }))}
          />
          แสดงบนหน้า Home
        </label>
      </div>

      <button
        type="submit"
        style={{
          padding: "10px 18px",
          borderRadius: 10,
          border: "none",
          background: "linear-gradient(135deg,#4f8cff,#a78bfa)",
          color: "#fff",
          fontWeight: 800,
          cursor: "pointer",
          minWidth: 160,
        }}
      >
        บันทึก
      </button>
    </form>
  );
}
