const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify connection on startup
transporter.verify((err) => {
  if (err) console.error('Email setup error:', err.message);
  else console.log('✅ Email service ready');
});

async function sendAlertEmail(to, subject, message) {
  try {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0e1a;color:#f1f5f9;padding:30px;border-radius:16px;">
        <div style="text-align:center;margin-bottom:20px;">
          <h1 style="color:#00d4aa;margin:0;">🩺 CareBand Alert</h1>
          <p style="color:#64748b;font-size:13px;">Dementia Care Emergency System</p>
        </div>
        <div style="background:#111827;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:20px;margin-bottom:20px;">
          <h2 style="color:#ef4444;margin:0 0 10px;">⚠️ ${subject}</h2>
          <p style="color:#f1f5f9;line-height:1.6;margin:0;">${message}</p>
        </div>
        <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:14px;margin-bottom:20px;">
          <p style="color:#ef4444;font-weight:bold;margin:0;">🚨 This is an automated emergency alert from CareBand.</p>
          <p style="color:#64748b;font-size:12px;margin:8px 0 0;">Time: ${new Date().toLocaleString()}</p>
        </div>
        <p style="color:#64748b;font-size:11px;text-align:center;">CareBand - Real-Time Dementia Care System</p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: `"CareBand Alert" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: `🚨 CareBand: ${subject}`,
      html: html
    });
    console.log('📧 Email sent to', to, ':', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Email send error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendAlertEmail };
