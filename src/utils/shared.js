import jwt from "jsonwebtoken";
import authConfig from "../config/auth.config.js";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";

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
export const sendEmail = async (email, subject, code, flow = 'rp') => {
  const templatePath = path.join(__dirname, 'recovery-password-template.html');
  const templatePathRegisterUser = path.join(__dirname, 'register-user-code-template.html');
  const templatePathUserAuthorization = path.join(__dirname, 'user-authorization.html');
  const templatePathWelcomeUser = path.join(__dirname, 'welcome-user-template.html');
  let templateContent;
  if (flow === 'ru') { // register user
    templateContent = fs.readFileSync(templatePathRegisterUser, 'utf-8');
  } else if (flow === 'ua') { // user authorization
    templateContent = fs.readFileSync(templatePathUserAuthorization, 'utf-8');
  }else if (flow === 'rp') { // recovery password
    templateContent = fs.readFileSync(templatePath, 'utf-8');
  }else if (flow === 'wu') { // welcome user
    templateContent = fs.readFileSync(templatePathWelcomeUser, 'utf-8');
  }

  
  let htmlTemplate = templateContent.replace('{{code}}', code);
  
  if (flow === 'wu') { // welcome user
    let link = 'https://soyvaliente.org/register?ref=' + code;
    let linkShow = `https://soyvaliente.org/register?ref=${code}`;
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
        filename: 'soy-valiente-logo.png',
        path: path.join(__dirname, './image/soy-valiente-logo.png'),
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
