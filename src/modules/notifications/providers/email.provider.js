import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
 host: "smtp-relay.brevo.com",
 port: 587,
 auth: {
  user: process.env.BREVO_USER,
  pass: process.env.BREVO_PASS,
 },
});

export const sendEmail = async ({ to, subject, html }) => {
 return transporter.sendMail({
  from: `${process.env.BREVO_APP_NAME_MEDIUM} <${process.env.BREVO_USER}>`,
  to,
  subject,
  html,
 });
};