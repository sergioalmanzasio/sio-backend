import jwt from "jsonwebtoken";
import authConfig from "../config/auth.config.js";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate token
export const generateToken = (user_id) => {
  return jwt.sign({ 
    id: user_id }, 
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
  let templateContent;
  if (flow === 'user-registration') { // user registration
    templateContent = fs.readFileSync(templatePathRegisterUser, 'utf-8');
  } else if (flow === 'user-authorization') { // user authorization
    templateContent = fs.readFileSync(templatePathUserAuthorization, 'utf-8');
  }else if (flow === 'recovery-password') { // recovery password
    templateContent = fs.readFileSync(templatePath, 'utf-8');
  }else if (flow === 'welcome-user') { // welcome user
    templateContent = fs.readFileSync(templatePathWelcomeUser, 'utf-8');
  }else if (flow === 'register-user-assistant') { // register user assistant
    templateContent = fs.readFileSync(templatePathRegisterUserAssistant, 'utf-8');
  }else if (flow === 'register-user-client') { // register user client
    templateContent = fs.readFileSync(templatePathRegisterUserClient, 'utf-8');
  }else if (flow === 'notification-admin-sysplt') { // notification admin sysplt
    templateContent = fs.readFileSync(templatePathNotificationAdminSysplt, 'utf-8');
  }

  
  let htmlTemplate = templateContent.replace('{{code}}', code)
                                    .replace('{{PersonName}}', personName)
                                    .replace('{{username}}', username);
  
  if (flow === 'welcome-user') { // welcome user
    let link = 'https://sio.com/register?ref=' + code;
    let linkShow = `https://sio.com/register?ref=${code}`;
    htmlTemplate = htmlTemplate.replace('{{link}}', link).replace('{{link-show}}', linkShow);

  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: subject,
    // text: text,
    html:htmlTemplate,
    attachments: [
      {
        filename: 'SIO-logo.jpg',
        path: path.join(__dirname, 'email-templates', './image/SIO-logo.jpg'),
        cid: 'logo-web-app' // Debe coincidir con el src="cid:..."
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error al enviar correo (process: ' + process + '), email: ' + email + ':', error);
    return false;
  }
  
};
