

async function createReservationWithPayment(userId, status, service_type, usePoint, replyToken) {
  // 1) กัน state หาย/หมดอายุ
  const must = ['appointment_date', 'appointment_time', 'barber_id'];
  const missing = must.filter(k => !status?.[k]);
  if (missing.length) {
    await db.ref(`booking_status/${userId}`).remove();
    await sendReply(replyToken, [{ type: 'text', text: 'เซสชันหมดอายุค่ะ กรุณาพิมพ์ "จองคิว" เพื่อเริ่มใหม่' }]);
    return;
  }

  const durationHours = parseInt(status.duration_hours || '1', 10);

  // 2) เช็กความว่างแบบ "ช่วงต่อเนื่อง"
  const check = await checkAvailabilityRange(
    status.appointment_date,
    status.appointment_time,
    durationHours,
    status.barber_id
  );
  if (!check.available) {
    await sendReply(replyToken, [
      { type: 'text', text: `${check.message}\nโปรดลองเริ่มใหม่โดยพิมพ์ "จองคิว"` },
    ]);
    await db.ref(`booking_status/${userId}`).remove();
    return;
  }

  // 3) สร้าง ref สำหรับบิลในครั้งนี้
  const paymentRef = generatePaymentRef();

  // 4) ใช้แต้ม = ฟรี → ข้ามออกบิล/QR แล้วไปจบการจองเลย
  if (usePoint === true) {
    await completeReservation(userId, status, service_type, true, replyToken, paymentRef, 'free');
    return;
  }

  // 5) แปลง start+duration → รายการ time_slots (เช่น ['14:00','15:00'])
  const time_slots = buildTimeSlots(status.appointment_time, durationHours);
  if (!time_slots.length) {
    await sendReply(replyToken, [{ type: 'text', text: 'ช่วงเวลาที่เลือกไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' }]);
    await db.ref(`booking_status/${userId}`).remove();
    return;
  }

  // 6) คำนวณมัดจำพื้นฐาน + ทำ "ยอดเฉพาะ" ต่อการจอง
  const baseDeposit = DEPOSIT_AMOUNT * durationHours;
  const uniqueAmount = computeUniqueAmount(baseDeposit, paymentRef); // <- คืนตัวเลข
  const expectedAmount = Number(uniqueAmount.toFixed(2));            // fix 2 ตำแหน่ง

  // 7) บันทึกการจองสถานะ pending
  const newReservation = db.ref('reservations').push();
  await newReservation.set({
    id: newReservation.key,
    customer_name: status.customer_name,
    appointment_date: status.appointment_date,
    appointment_time: status.appointment_time, // เวลาเริ่ม
    time_slots,                                 // เก็บทุกช่องเวลา
    duration_hours: durationHours,
    service_type,
    barber_id: status.barber_id,
    created_at: new Date().toISOString(),
    line_user_id: userId,
    use_point: false,
    payment_ref: paymentRef,
    payment_status: 'pending',
    deposit_amount: expectedAmount,             // ✅ เก็บยอดเฉพาะไว้ให้ OCR จับคู่
  });

  // 8) อัปเดตสถานะ flow ผู้ใช้ → ไปรอการชำระ
  await db.ref(`booking_status/${userId}`).update({
    reservation_id: newReservation.key,
    payment_ref: paymentRef,
    expected_amount: expectedAmount,
    duration_hours: durationHours,
    step: 'waiting_payment',
  });

  // 9) เตรียมข้อมูลโชว์เวลาช่วง (สวย ๆ)
  const timeLabel = (time_slots.length > 1)
    ? formatTimeRange(time_slots)                // เช่น "14:00 - 16:00 (2 ชม.)"
    : status.appointment_time;

  // 10) สร้าง QR และส่ง Flex ให้ลูกค้า
  const qrUrl = generatePromptPayQR(expectedAmount, paymentRef);

  const reservationDetails = {
    customer_name: status.customer_name,
    service_type,
    appointment_date: status.appointment_date,
    appointment_time: timeLabel,
    duration_hours: durationHours,
  };

  const qrMessage = createPaymentQRFlexMessage(
    qrUrl,
    expectedAmount,
    paymentRef,
    reservationDetails
  );

  await sendReply(replyToken, [qrMessage]);
}
