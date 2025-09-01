// route/payment.js
const express = require('express');
const router = express.Router();
const { generatePromptPayQR } = require('../utils/promptpay');

// ตัวเดียวใช้ได้ทั้งแบบ mount มี/ไม่มี prefix
function handleQr(req, res) {
  try {
    const amount = Number(req.query.amount);
    const ref = String(req.query.ref || '').trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'invalid amount' });
    }
    if (!ref) {
      return res.status(400).json({ error: 'missing ref' });
    }

    const png = generatePromptPayQR(amount, ref); // <-- ต้องคืน Buffer ของ PNG
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-store, max-age=0');
    return res.send(png);
  } catch (e) {
    console.error('QR generation error:', e);
    return res.status(500).json({ error: 'failed to generate qr' });
  }
}

// รองรับทั้ง 2 path
router.get('/payment/qr', handleQr);
router.get('/qr', handleQr);

module.exports = router;
