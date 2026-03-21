import twilio from "twilio";

const client = twilio(
 process.env.TWILIO_SID,
 process.env.TWILIO_TOKEN
);

export const sendOTP = async ({ to }) => {
 return client.verify.v2
  .services(process.env.TWILIO_SERVICE_SID)
  .verifications.create({
   to,
   channel: "sms",
  });
};

export const verifyOTP = async ({ to, code }) => {
 return client.verify.v2
  .services(process.env.TWILIO_SERVICE_SID)
  .verificationChecks.create({
   to,
   code,
  });
};