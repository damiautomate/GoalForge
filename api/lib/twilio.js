// Twilio WhatsApp message sender

import twilio from 'twilio';

let twilioClient = null;

function getClient() {
  if (!twilioClient) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

export async function sendWhatsApp(to, body) {
  const from = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  try {
    const msg = await getClient().messages.create({
      from, to: toFormatted, body,
    });
    console.log(`📤 Sent to ${toFormatted}: ${body.slice(0, 60)}...`);
    return msg.sid;
  } catch (e) {
    console.error(`❌ Send failed to ${toFormatted}:`, e.message);
    throw e;
  }
}
