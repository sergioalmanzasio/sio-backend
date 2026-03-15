import jwt from "jsonwebtoken";
import authConfig from "../config/auth.config.js";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { fileURLToPath } from 'url';
import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resend = new Resend(process.env.RESEND_API_KEY);

// Generate token
export const generateToken = (user_id) => {
  return jwt.sign({
    id: user_id
  },
    authConfig.secret,
    {
      expiresIn: authConfig.expiresIn,
    }
  );
};

// Generate transversal uuid
export const transversalUUID = () => {
  return "00000000-0000-0000-0000-000000000000";
};

// Generate verification code
export const generateVerificationCode = () => {
  const code = crypto.randomInt(100000, 999999); // solo números
  return code;
};

// Generate code by uuid with last 6 characters
export const generateCodeByUuid = (id) => {
  return id.replace(/-/g, '').slice(-6);
};

// Get expiration date
export const getExpirationDate = () => {
  return new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
};

// Send email
export const sendEmail = async (email, subject, code = '000000', personName, username = 'test@correo.com', flow = 'recovery-password') => {
  const templatePath = path.join(__dirname, 'email-templates', 'recovery-password-template.html');
  const templatePathRegisterUser = path.join(__dirname, 'email-templates', 'register-user-code-template.html');
  const templatePathUserAuthorization = path.join(__dirname, 'email-templates', 'user-authorization.html');
  const templatePathWelcomeUser = path.join(__dirname, 'email-templates', 'welcome-user-template.html');
  const templatePathRegisterUserAssistant = path.join(__dirname, 'email-templates', 'register-user-assistant.html');
  const templatePathRegisterUserClient = path.join(__dirname, 'email-templates', 'register-user-client.html');
  const templatePathNotificationAdminSysplt = path.join(__dirname, 'email-templates', 'notification-admin-sysplt.html');
  const templatePathNotificationClientServiceRequest = path.join(__dirname, 'email-templates', 'notification-client-service-request.html');
  let templateContent;
  if (flow === 'user-registration') { // user registration
    templateContent = fs.readFileSync(templatePathRegisterUser, 'utf-8');
  } else if (flow === 'user-authorization') { // user authorization
    templateContent = fs.readFileSync(templatePathUserAuthorization, 'utf-8');
  } else if (flow === 'recovery-password') { // recovery password
    templateContent = fs.readFileSync(templatePath, 'utf-8');
  } else if (flow === 'welcome-user') { // welcome user
    templateContent = fs.readFileSync(templatePathWelcomeUser, 'utf-8');
  } else if (flow === 'register-user-assistant') { // register user assistant
    templateContent = fs.readFileSync(templatePathRegisterUserAssistant, 'utf-8');
  } else if (flow === 'register-user-client') { // register user client
    templateContent = fs.readFileSync(templatePathRegisterUserClient, 'utf-8');
  } else if (flow === 'notification-admin-sysplt') { // notification admin sysplt
    templateContent = fs.readFileSync(templatePathNotificationAdminSysplt, 'utf-8');
  } else if (flow === 'notification-client-service-request') { // notification client service request
    templateContent = fs.readFileSync(templatePathNotificationClientServiceRequest, 'utf-8');
  }


  let htmlTemplate = templateContent.replace('{{code}}', code)
    .replace('{{PersonName}}', personName)
    .replace('{{username}}', username);

  if (flow === 'welcome-user') { // welcome user
    let link = 'https://sio.com/register?ref=' + code;
    let linkShow = `https://sio.com/register?ref=${code}`;
    htmlTemplate = htmlTemplate.replace('{{link}}', link).replace('{{link-show}}', linkShow);

  }

  try {
    const logoPath = path.join(__dirname, 'email-templates', './image/SIO-logo.png');
    const logoBase64 = fs.readFileSync(logoPath).toString('base64');
    const result = await resend.emails.send({
      from: 'SIO App <no-reply@siocolombia.com>',
      to: email,
      subject: subject,
      html: htmlTemplate,
      attachments: [
        {
          filename: 'SIO-logo.png',
          content: logoBase64,         // base64 string
          content_type: 'image/png',
          content_id: 'logo-web-app',  // equivalente al cid
          inline: true,
        },
      ],
    });

    if (result.error) {
      console.error(`[sendEmail] flow=${flow} email=${email} Resend error:`, result.error);
      return false;
    }
    return !!result.data?.id;
  } catch (error) {
    console.error(`[sendEmail] flow=${flow} email=${email}`, error.message);
    return false;
  }

  // try {
  //   let sendToEmail = await transporter.sendMail(mailOptions);
  //   if (sendToEmail.response) {
  //     return true;
  //   }
  //   return false;
  // } catch (error) {
  //   console.error('Error al enviar correo (process: ' + process + '), email: ' + email + ':', error);
  //   return false;
  // }

};

// GET USER SYSTEM ENV 
export const getUserSystemEnv = () => {
  return process.env.EMAILS_SYS;
};

