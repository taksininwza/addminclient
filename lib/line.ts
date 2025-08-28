export async function sendLinePush(to: string, message: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is missing");

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text: message }],
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("LINE push failed:", res.status, text);
    throw new Error(`LINE push failed: ${res.status} ${text}`);
  }
  return { ok: true };
}
