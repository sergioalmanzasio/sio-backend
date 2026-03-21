import twilio from "twilio";

const client = twilio(
 process.env.TWILIO_SID,
 process.env.TWILIO_TOKEN
);

export const sendWhatsApp = async ({ to, message }) => {
 return client.messages.create({
  from: process.env.TWILIO_WHATSAPP_FROM_PHONE,
  to: `whatsapp:${to}`,
  body: message,
 });
};