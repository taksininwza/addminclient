// app/admin/Barbers.tsx
"use client";
import React, { useMemo, useState } from "react";

/* ===== เวลาร้าน (ให้ตรงกับฝั่งจองคิว/หาเวลาว่าง) ===== */
const OPEN_HOUR = 10;
const CLOSE_HOUR = 20;
const SLOT_MIN = 60;
const LUNCH_START = 12;
const LUNCH_END = 13;

/* ===== Types ===== */
export interface Barber { name: string }
export type UnavailableBlock = {
  id: string;
  date: string;   // YYYY-MM-DD
  start: string;  // HH:mm
  end: string;    // HH:mm
  note?: string;
};

type Props = {
  barbers: Record<string, Barber>;
  addBarber: (name: string) => void | Promise<void>;
  deleteBarber: (id: string) => void | Promise<void>;

  /** { [barberId]: Array<{id,date,start,end,note}> } */
  unavailability?: Record<string, UnavailableBlock[]>;

  /** เพิ่มบล็อก “ไม่รับคิว” ให้ช่าง */
  addUnavailable?: (barberId: string, block: Omit<UnavailableBlock, "id">) => void | Promise<void>;
  /** ลบบล็อก “ไม่รับคิว” */
  deleteUnavailable?: (barberId: string, blockId: string) => void | Promise<void>;
};

/* ===== Helpers ===== */
function buildTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
    if (h >= LUNCH_START && h < LUNCH_END) continue; // ข้ามพักเที่ยง
    const hh = String(h).padStart(2, "0");
    slots.push(`${hh}:00`);
  }
  return slots;
}
const SLOTS = buildTimeSlots();
const END_SLOTS = [...SLOTS.slice(1), "23:59"];

function isValidISODate(s: string) {
  // ยอมรับรูปแบบ YYYY-MM-DD แบบตรงเป๊ะ
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/* ===== UI bits ===== */
const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  padding: 14,
  border: "1px solid #eef2f7",
  boxShadow: "0 1px 8px rgba(0,0,0,.04)",
};
const inputCss: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cfd8dc",
  background: "#fff",
  outline: "none",
  fontSize: 14,
};

/* ===== Modal ===== */
type ModalOpen =
  | { open: false }
  | {
      open: true;
      barberId: string;
      barberName: string;
    };

// ✅ type guard เพื่อให้ TS narrow ได้แน่นอน
function isModalOpen(s: ModalOpen): s is Extract<ModalOpen, { open: true }> {
  return s.open === true;
}

function UnavailableModal({
  openState,
  onClose,
  onSave,
}: {
  openState: ModalOpen;
  onClose: () => void;
  onSave: (payload: { barberId: string; date: string; start: string; end: string; note: string }) => void;
}) {
  if (!isModalOpen(openState)) return null; // narrowed แล้ว

  // destructure หลัง narrow
  const { barberId, barberName } = openState;

  // controlled local state
  const [mode, setMode] = useState<"allday" | "hourly">("allday");
  const [date, setDate]   = useState("");
  const [start, setStart] = useState(SLOTS[0] ?? "10:00");
  const [end, setEnd]     = useState(END_SLOTS[END_SLOTS.length - 1] ?? "20:00");
  const [note, setNote]   = useState("");
  const [err, setErr]     = useState<string | null>(null);

  const canSave = !!date && (mode === "allday" || (start && end && start < end));

  function handleSave() {
    if (!canSave) {
      setErr(
        mode === "allday"
          ? "กรุณาเลือกวันที่"
          : "กรุณาเลือกวันที่และช่วงเวลาให้ถูกต้อง (เวลาเริ่มต้องน้อยกว่าสิ้นสุด)"
      );
      return;
    }
    setErr(null);
    onSave({
      barberId,
      date,
      start: mode === "allday" ? "00:00" : start,
      end:   mode === "allday" ? "23:59" : end,
      note,
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,.35)",
        zIndex: 1000,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
      role="dialog"
      aria-modal="true"
    >
      <div style={{ ...card, width: "min(680px, 96vw)", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>
            เพิ่มช่วงไม่รับคิว — {barberName}
          </div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            style={{ background: "transparent", border: 0, fontSize: 22, lineHeight: 1, cursor: "pointer", color: "#64748b" }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {/* โหมด */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <input type="radio" name="mode" checked={mode === "allday"} onChange={() => setMode("allday")} />
              ทั้งวัน
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <input type="radio" name="mode" checked={mode === "hourly"} onChange={() => setMode("hourly")} />
              รายชั่วโมง
            </label>
          </div>

          {/* วันที่ */}
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6, color: "#c2185b" }}>วันที่</div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputCss} />
          </div>

          {/* เวลา */}
          {mode === "hourly" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#c2185b" }}>เริ่ม</div>
                <select value={start} onChange={(e) => setStart(e.target.value)} style={inputCss}>
                  <option value="">— เลือกเวลาเริ่ม —</option>
                  {SLOTS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#c2185b" }}>สิ้นสุด</div>
                <select value={end} onChange={(e) => setEnd(e.target.value)} style={inputCss}>
                  <option value="">— เลือกเวลาสิ้นสุด —</option>
                  {END_SLOTS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                  * อิงช่วงเปิดร้าน และข้ามพักเที่ยง 12:00–13:00
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: "#64748b", fontWeight: 600 }}>จะปิดรับทั้งวัน (00:00–23:59)</div>
          )}

          {/* หมายเหตุ */}
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6, color: "#c2185b" }}>หมายเหตุ (ถ้ามี)</div>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ลาพักร้อน/ติดธุระ เป็นต้น"
              style={inputCss}
            />
          </div>

          {err && (
            <div style={{ color: "#b00020", background: "#ffeaea", borderRadius: 8, padding: "8px 10px" }}>
              {err}
            </div>
          )}

          {/* ปุ่ม */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
            <button
              onClick={onClose}
              style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 700, cursor: "pointer" }}
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                background: canSave ? "linear-gradient(135deg,#ff7ac8,#b07cff)" : "#e5e7eb",
                color: canSave ? "#fff" : "#94a3b8",
                fontWeight: 800,
                cursor: canSave ? "pointer" : "not-allowed",
              }}
            >
              บันทึก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Main ===== */
const BarbersPage: React.FC<Props> = ({
  barbers,
  addBarber,
  deleteBarber,
  unavailability = {},
  addUnavailable,
  deleteUnavailable,
}) => {
  const [newBarberName, setNewBarberName] = useState("");
  const [modal, setModal] = useState<ModalOpen>({ open: false });

  // ✅ ส่วนปิดร้านหลายวัน (ทั้งร้าน)
  const [bulkDates, setBulkDates] = useState<string[]>([""]);
  const [bulkNote, setBulkNote] = useState<string>("ร้านปิด");

  const totalBarbers = useMemo(() => Object.keys(barbers).length, [barbers]);

  async function handleSaveModal(payload: { barberId: string; date: string; start: string; end: string; note: string }) {
    try {
      if (!addUnavailable) {
        alert("ยังไม่ได้เชื่อมฟังก์ชัน addUnavailable จากหน้าแม่");
        return;
      }
      await addUnavailable(payload.barberId, {
        date: payload.date,
        start: payload.start,
        end: payload.end,
        note: payload.note,
      });
      setModal({ open: false });
      alert("บันทึกช่วงไม่รับคิวเรียบร้อย");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "บันทึกไม่สำเร็จ");
    }
  }

  async function handleCloseShopAll() {
    if (!addUnavailable) {
      alert("ยังไม่ได้เชื่อมฟังก์ชัน addUnavailable จากหน้าแม่");
      return;
    }
    const dates = bulkDates.map((d) => d.trim()).filter((d) => d && isValidISODate(d));
    if (dates.length === 0) {
      alert("กรุณาใส่วันที่อย่างน้อย 1 วัน (รูปแบบ YYYY-MM-DD)");
      return;
    }
    if (Object.keys(barbers).length === 0) {
      alert("ยังไม่มีรายชื่อช่าง");
      return;
    }

    if (!confirm(`ยืนยันปิดร้านทั้งร้านใน ${dates.length} วัน ?`)) return;

    try {
      for (const bid of Object.keys(barbers)) {
        for (const d of dates) {
          await addUnavailable(bid, {
            date: d,
            start: "00:00",
            end: "23:59",
            note: bulkNote || "ร้านปิด",
          });
        }
      }
      alert("บันทึกการปิดร้านเรียบร้อย");
      setBulkDates([""]);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <div>
      {/* Summary */}
      <div style={{ display: "flex", gap: 32, marginBottom: 32, flexWrap: "wrap" }}>
        <div
          style={{
            flex: 1,
            minWidth: 220,
            background: "linear-gradient(135deg, #43e97b 60%, #38f9d7 100%)",
            color: "#fff",
            borderRadius: 14,
            padding: 28,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 600 }}>จำนวนช่างทั้งหมด</div>
          <div style={{ fontSize: 48, fontWeight: 800, margin: "12px 0" }}>{totalBarbers}</div>
        </div>
      </div>

      {/* Add barber */}
      <div style={{ marginBottom: 24, display: "flex", gap: 12, alignItems: "center" }}>
        <input
          type="text"
          placeholder="ชื่อช่างใหม่"
          value={newBarberName}
          onChange={(e) => setNewBarberName(e.target.value)}
          style={{ ...inputCss, flex: "0 0 260px" }}
        />
        <button
          onClick={async () => {
            const n = newBarberName.trim();
            if (!n) return;
            await addBarber(n);
            setNewBarberName("");
          }}
          style={{
            padding: "10px 18px",
            background: "#22c55e",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          เพิ่มช่าง
        </button>
      </div>

      {/* List */}
      <div style={card}>
        <h3 style={{ margin: 0, marginBottom: 10, color: "#22223b" }}>รายชื่อช่าง</h3>

        {Object.keys(barbers).length === 0 && <p>ยังไม่มีรายชื่อช่าง</p>}

        <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0, display: "grid", gap: 14 }}>
          {Object.entries(barbers).map(([id, barber]) => {
            const blocks = (unavailability[id] ?? []).slice().sort((a, b) => {
              const k1 = `${a.date} ${a.start}`;
              const k2 = `${b.date} ${b.start}`;
              return k1.localeCompare(k2);
            });

            return (
              <li
                key={id}
                style={{
                  background: "#f7f9fb",
                  border: "1px solid #eef2f7",
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{barber.name}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setModal({ open: true, barberId: id, barberName: barber.name })}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        background: "#fff",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      เพิ่มช่วงไม่รับคิว
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("ยืนยันการลบช่างนี้?")) return;
                        await deleteBarber(id);
                      }}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "none",
                        background: "#ef4444",
                        color: "#fff",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      ลบช่าง
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>ช่วงที่ปิดรับ</div>

                  {blocks.length === 0 ? (
                    <div style={{ color: "#64748b", fontStyle: "italic" }}>— ยังไม่มี —</div>
                  ) : (
                    <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0, display: "grid", gap: 8 }}>
                      {blocks.map((bk) => (
                        <li
                          key={bk.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "#fdf2f8",
                            border: "1px solid #ffd6ec",
                            borderRadius: 10,
                            padding: "8px 10px",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <b>{bk.date}</b> • {bk.start}–{bk.end}
                            {bk.note ? <span style={{ color: "#64748b" }}> — {bk.note}</span> : null}
                          </div>
                          <button
                            onClick={() => deleteUnavailable && deleteUnavailable(id, bk.id)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "none",
                              background: "#f43f5e",
                              color: "#fff",
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            ลบ
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ===== ปิดร้านทั้งร้าน (เลือกหลายวัน) ===== */}
      <div style={{ ...card, marginTop: 18 }}>
        <h3 style={{ margin: 0, marginBottom: 10, color: "#22223b" }}>วันหยุด</h3>

        <div style={{ display: "grid", gap: 10 }}>
          {/* รายการวันหลายแถว */}
          {bulkDates.map((d, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="date"
                value={d}
                onChange={(e) => {
                  const next = [...bulkDates];
                  next[idx] = e.target.value;
                  setBulkDates(next);
                }}
                style={{ ...inputCss, width: 200 }}
              />
              <button
                onClick={() => {
                  const next = bulkDates.filter((_, i) => i !== idx);
                  setBulkDates(next.length ? next : [""]);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
                aria-label="ลบแถววันนี้"
              >
                ลบวัน
              </button>
            </div>
          ))}

          <div>
            <button
              onClick={() => setBulkDates((x) => [...x, ""])}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px dashed #cbd5e1",
                background: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              + เพิ่มวัน
            </button>
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 6, color: "#c2185b" }}>หมายเหตุ</div>
            <input
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
              placeholder="เช่น ร้านปิด / วันหยุดพิเศษ"
              style={{ ...inputCss, width: "min(520px, 100%)" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={handleCloseShopAll}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg,#ff7ac8,#b07cff)",
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              หยุดร้าน
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      <UnavailableModal
        openState={modal}
        onClose={() => setModal({ open: false })}
        onSave={handleSaveModal}
      />
    </div>
  );
};

export default BarbersPage;
