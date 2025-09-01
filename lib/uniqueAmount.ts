export function computeUniqueAmount(base: number, paymentRef: string, extraSalt = ''): number {
  let acc = 0;
  const seed = String(paymentRef || '') + '|' + String(extraSalt || '');
  for (let i = 0; i < seed.length; i++) {
    acc = (acc + seed.charCodeAt(i) * (i + 11)) % 90; // 0..89
  }
  const satang = acc + 10; // 10..99
  return Number((Number(base) + satang / 100).toFixed(2));
}
