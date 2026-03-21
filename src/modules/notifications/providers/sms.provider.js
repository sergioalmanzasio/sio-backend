import twilio from "twilio";

const client = twilio(
 process.env.TWILIO_SID,
 process.env.TWILIO_TOKEN
);

export const sendSMS = async ({ to, message }) => {
 return client.messages.create({
  body: message,
  from: process.env.TWILIO_PHONE,
  to,
 });
};