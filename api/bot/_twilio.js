// Twilio WhatsApp messaging
import twilio from 'twilio';
import { config } from './_config.js';

let client = null;

function getClient() {
  if (!client) client = twilio(config.twilioSid, config.twilioToken);
  return client;
}

export async function sendMessage(to, body) {
  try {
    await getClient().messages.create({
      from: config.twilioNumber,
      to,
      body,
    });
    console.log(`✉️ Sent to ${to}: ${body.slice(0, 80)}...`);
  } catch (e) {
    console.error(`❌ Send failed to ${to}:`, e.message);
    throw e;
  }
}
