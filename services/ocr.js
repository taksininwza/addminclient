// services/ocr.js
const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

async function ocrImageToText(imageBuffer) {
  const tmp = os.tmpdir();
  const inPath = path.join(tmp, `slip_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);
  await fs.promises.writeFile(inPath, imageBuffer);

  const tesseractCmd = process.env.TESSERACT_CMD || 'tesseract';
  const args = [inPath, 'stdout', '-l', 'eng+tha', '--psm', '6'];

  return new Promise((resolve, reject) => {
    let out = '', err = '';
    const p = spawn(tesseractCmd, args);
    p.stdout.on('data', d => out += d.toString('utf8'));
    p.stderr.on('data', d => err += d.toString('utf8'));
    p.on('close', async (code) => {
      try { await fs.promises.unlink(inPath); } catch {}
      if (code === 0) resolve(out);
      else reject(new Error(err || `tesseract exit ${code}`));
    });
  });
}

// ดึงจำนวนเงินแบบ 2 ทศนิยม เช่น 20.37 / 1,234.56 (จะมี/ไม่มี 'บาท' ก็ได้)
function extractAmountFromText(text) {
  if (!text) return null;
  const cleaned = text.replace(/\s+/g, ' ');
  const m = cleaned.match(/([\d,]+\.\d{2})\s*(บาท|THB)?/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ''));
  return Number.isFinite(num) ? Number(num.toFixed(2)) : null;
}

module.exports = { ocrImageToText, extractAmountFromText };
