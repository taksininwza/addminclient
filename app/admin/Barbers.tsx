// app/admin/Barbers.tsx
"use client";
import React from "react";

/* ===== เวลาร้าน (ให้ตรงกับฝั่งจองคิว/หาเวลาว่าง) ===== */
const OPEN_HOUR = 10;
const CLOSE_HOUR = 20;
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

type UnavailMap = Record<string, UnavailableBlock[]>;

type Props = {
  barbers: Record<string, Barber>;
  addBarber: (name: string) => void | Promise<void>;
  deleteBarber: (id: string) => void | Promise<void>;

  /** { [barberId]: Array<{id,date,start,end,note}> } */
  unavailability?: UnavailMap;

  /** เพิ่มบล็อก “ไม่รับคิว” ให้ช่าง */
  addUnavailable?: (barberId: string, block: Omit<UnavailableBlock, "id">) => void | Promise<void>;
  /** ลบบล็อก “ไม่รับคิว” */
  deleteUnavailable?: (barberId: string, blockId: string) => void | Promise<void>;

  /** ปิดร้านหลายวัน (ทั้งวัน 00:00–23:59) */
  addShopClosedDates?: (dates: string[]) => void | Promise<void>;
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
const btnPrimary: React.CSSProperties = {
  padding: "10px 18px",
  background: "linear-gradient(135deg,#ff7ac8,#b07cff)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontWeight: 800,
  cursor: "pointer",
};

/* ===== Modal Types ===== */
type ModalOpen =
  | { open: false }
  | {
      open: true;
      barberId: string;
      barberName: string;
    };

/* ===== UnavailableModal (no conditional hooks) ===== */
function UnavailableModal({
  openState,
  onClose,
  onSave,
}: {
  openState: ModalOpen;
  onClose: () => void;
  onSave: (payload: { barberId: string; date: string; start: string; end: string; note: string }) => void;
}) {
  // Hooks always at top:
  const [mode, setMode]   = React.useState<"allday" | "hourly">("allday");
  const [date, setDate]   = React.useState("");
  const [start, setStart] = React.useState(SLOTS[0] ?? "10:00");
  const [end, setEnd]     = React.useState(END_SLOTS[END_SLOTS.length - 1] ?? "20:00");
  const [note, setNote]   = React.useState("");
  const [err, setErr]     = React.useState<string | null>(null);

  const isOpen     = openState.open === true;
  const barberId   = isOpen ? openState.barberId   : "";
  const barberName = isOpen ? openState.barberName : "";

  if (!isOpen) return null;

  const canSave = !!date && (mode === "allday" || (start && end && start < end));

  function handleSave() {
    if (!canSave) {
      setErr(
        mode === "allday"
          ? "กรุณาเลือกวันที่"
          : "กรุณาเลือกช่วงเวลาให้ถูกต้อง (เวลาเริ่มต้องน้อยกว่าสิ้นสุด)"
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
              <input type="radio" name="ua-mode" checked={mode === "allday"} onChange={() => setMode("allday")} />
              ทั้งวัน
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <input type="radio" name="ua-mode" checked={mode === "hourly"} onChange={() => setMode("hourly")} />
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
  addShopClosedDates,
}) => {
  const [newBarberName, setNewBarberName] = React.useState("");
  const [modal, setModal] = React.useState<ModalOpen>({ open: false });

  // ปิดร้านหลายวัน (อินพุตหลายบรรทัด: YYYY-MM-DD คั่นด้วยเว้นบรรทัดหรือจุลภาค)
  const [shopCloseInput, setShopCloseInput] = React.useState("");

  const totalBarbers = React.useMemo(() => Object.keys(barbers).length, [barbers]);

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
    } catch (e) {
      console.error(e);
      alert("บันทึกไม่สำเร็จ");
    }
  }

  function parseDatesInput(raw: string): string[] {
    const tokens = raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const iso = tokens.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    return Array.from(new Set(iso)); // unique
  }

  async function handleShopCloseSubmit() {
    const dates = parseDatesInput(shopCloseInput);
    if (dates.length === 0) {
      alert("กรุณากรอกวันที่รูปแบบ YYYY-MM-DD อย่างน้อย 1 วัน (คั่นด้วยบรรทัดใหม่หรือ ,)");
      return;
    }
    if (!addShopClosedDates) {
      alert("ยังไม่ได้เชื่อมฟังก์ชัน addShopClosedDates จากหน้าแม่");
      return;
    }
    try {
      await addShopClosedDates(dates);
      setShopCloseInput("");
      alert("บันทึกวันปิดร้านสำเร็จ");
    } catch (e) {
      console.error(e);
      alert("บันทึกวันปิดร้านไม่สำเร็จ");
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
          style={btnPrimary}
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

      {/* Modal */}
      <UnavailableModal
        openState={modal}
        onClose={() => setModal({ open: false })}
        onSave={handleSaveModal}
      />

      {/* ===== ปิดร้านหลายวัน (ทั้งวัน) ===== */}
      <div style={{ ...card, marginTop: 20 }}>
        <h3 style={{ margin: 0, marginBottom: 10, color: "#22223b" }}>ปิดร้านหลายวัน (ทั้งวัน)</h3>
        <div style={{ color: "#64748b", marginBottom: 10 }}>
          กรอกวันที่รูปแบบ <b>YYYY-MM-DD</b> ได้หลายวัน คั่นด้วยบรรทัดใหม่หรือเครื่องหมายจุลภาค <b>,</b><br />
          เช่น <code>2025-09-10</code>, <code>2025-09-12</code>
        </div>
        <textarea
          rows={4}
          placeholder={"เช่น:\n2025-09-10\n2025-09-12, 2025-09-18"}
          value={shopCloseInput}
          onChange={(e) => setShopCloseInput(e.target.value)}
          style={{ ...inputCss, width: "100%", resize: "vertical" }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
          <button
            onClick={handleShopCloseSubmit}
            style={btnPrimary}
          >
            บันทึกวันปิดร้าน
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarbersPage;
