// Shared server config for WhatsApp bot
import admin from 'firebase-admin';

let db = null;

export function getDb() {
  if (!db) {
    if (!admin.apps.length) {
      const key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
      admin.initializeApp({ credential: admin.credential.cert(key) });
    }
    db = admin.firestore();
  }
  return db;
}

export const config = {
  twilioSid: process.env.TWILIO_ACCOUNT_SID,
  twilioToken: process.env.TWILIO_AUTH_TOKEN,
  twilioNumber: process.env.TWILIO_WHATSAPP_NUMBER, // whatsapp:+14155238886
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  cronSecret: process.env.CRON_SECRET || 'goalforge-cron-secret',
  timezone: 'Africa/Lagos', // WAT
};

// Get current WAT time
export function getWATTime() {
  const now = new Date();
  const wat = new Date(now.toLocaleString('en-US', { timeZone: config.timezone }));
  return {
    hour: wat.getHours(),
    minute: wat.getMinutes(),
    day: wat.getDay(),
    dayName: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][wat.getDay()],
    date: wat.getDate(),
    monthName: wat.toLocaleString('en', { month: 'long', timeZone: config.timezone }),
    year: wat.getFullYear(),
    full: wat.toLocaleString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: config.timezone }),
    iso: now.toISOString().slice(0, 10),
    ym: `${wat.getFullYear()}-${String(wat.getMonth() + 1).padStart(2, '0')}`,
  };
}
