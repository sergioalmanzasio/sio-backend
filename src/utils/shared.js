import jwt from "jsonwebtoken";
import authConfig from "../config/auth.config.js";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { fileURLToPath } from 'url';
import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resend = new Resend(process.env.RESEND_API_KEY);
const contactEmail = process.env.EMAIL_SIO_CONTACT;

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
export const sendEmail = async (email, subject, code = '000000', personName, username = 'test@correo.com', flow = 'recovery-password', referred_name = '', amount = '') => {
  const templatePath = path.join(__dirname, 'email-templates', 'recovery-password-template.html');
  const templatePathRegisterUser = path.join(__dirname, 'email-templates', 'register-user-code-template.html');
  const templatePathUserAuthorization = path.join(__dirname, 'email-templates', 'user-authorization.html');
  const templatePathWelcomeUser = path.join(__dirname, 'email-templates', 'welcome-user-template.html');
  const templatePathRegisterUserAssistant = path.join(__dirname, 'email-templates', 'register-user-assistant.html');
  const templatePathRegisterUserClient = path.join(__dirname, 'email-templates', 'register-user-client.html');
  const templatePathNotificationAdminSysplt = path.join(__dirname, 'email-templates', 'notification-admin-sysplt.html');
  const templatePathNotificationClientServiceRequest = path.join(__dirname, 'email-templates', 'notification-client-service-request.html');
  const templatePathNotificationPaymentCommision = path.join(__dirname, 'email-templates', 'notification-payment-commision.html');
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
  } else if (flow === 'notification-payment-commision') { // notification payment commision
    templateContent = fs.readFileSync(templatePathNotificationPaymentCommision, 'utf-8');
  }


  let htmlTemplate = templateContent.replace('{{code}}', code)
    .replace('{{PersonName}}', personName)
    .replace('{{username}}', username)
    .replace('{{referred_name}}', referred_name)
    .replace('{{amount}}', amount);

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

export const sendEmailV2 = async (email, subject, flow = 'recovery-password', options = {}) => {
  const templatePath = path.join(__dirname, 'email-templates', 'recovery-password-template.html');
  const templatePathRegisterUser = path.join(__dirname, 'email-templates', 'register-user-code-template.html');
  const templatePathUserAuthorization = path.join(__dirname, 'email-templates', 'user-authorization.html');
  const templatePathWelcomeUser = path.join(__dirname, 'email-templates', 'welcome-user-template.html');
  const templatePathRegisterUserAssistant = path.join(__dirname, 'email-templates', 'register-user-assistant.html');
  const templatePathRegisterUserReferral = path.join(__dirname, 'email-templates', 'register-user-referral.html');
  const templatePathNotificationAdminSysplt = path.join(__dirname, 'email-templates', 'notification-admin-sysplt.html');
  const templatePathNotificationClientServiceRequest = path.join(__dirname, 'email-templates', 'notification-client-service-request.html');
  const templatePathNotificationPaymentCommision = path.join(__dirname, 'email-templates', 'notification-payment-commision.html');
  const templatePathNotificationRequestGenerated = path.join(__dirname, 'email-templates', 'notification-request-generated.html');
  const templatePathNotificationRequestGeneratedClient = path.join(__dirname, 'email-templates', 'notification-request-generated-client.html');
  const templatePathNotificationUpdateRequest = path.join(__dirname, 'email-templates', 'notification-update-request.html');
  const templatePathNotificationUpdateRequestClient = path.join(__dirname, 'email-templates', 'notification-update-request-client.html');
  const templatePathRecoveryPassword = path.join(__dirname, 'email-templates', 'recovery-password.html');
  const templatePathWelcomeClientRegistered = path.join(__dirname, 'email-templates', 'welcome-client-registered.html');
  const templatePathNotificationReferralRequestPaymentCommision = path.join(__dirname, 'email-templates', 'notification-referral-request-payment-commision.html');
  const templatePathNotificationReferralRequestPaymentBonus = path.join(__dirname, 'email-templates', 'notification-referral-request-payment-bonus.html');
  const templatePathNotificationToAdminRequestPaymentCommision = path.join(__dirname, 'email-templates', 'notification-to-admin-request-payment-commision.html');
  const templatePathNotificationToReferralPaidCommision = path.join(__dirname, 'email-templates', 'notification-to-referral-paid-commision.html');
  const templatePathNotificationToAdminRequestPaymentBonus = path.join(__dirname, 'email-templates', 'notification-to-admin-request-payment-bonus.html');
  let templateContent;

  switch (flow) {
    case 'user-registration': // user registration
      templateContent = fs.readFileSync(templatePathRegisterUser, 'utf-8');
      const { person_name, code } = options;
      templateContent = templateContent
        .replace('{{person_name}}', person_name)
        .replace('{{code}}', code);
      break;

    case 'user-authorization': // user authorization
      templateContent = fs.readFileSync(templatePathUserAuthorization, 'utf-8');
      break;

    case 'welcome-user': // welcome user
      templateContent = fs.readFileSync(templatePathWelcomeUser, 'utf-8');
      const { code: refCode } = options;
      let link = 'https://sio.com/register?ref=' + refCode;
      let linkShow = `https://sio.com/register?ref=${refCode}`;
      templateContent = templateContent
        .replace('{{link}}', link)
        .replace('{{link-show}}', linkShow);
      break;

    case 'register-user-assistant': // register user assistant
      templateContent = fs.readFileSync(templatePathRegisterUserAssistant, 'utf-8');
      break;

    case 'welcome-client-registered': // welcome client registered
      const { customer_name } = options;
      templateContent = fs.readFileSync(templatePathWelcomeClientRegistered, 'utf-8');
      templateContent = templateContent.replace('{{customer_name}}', customer_name);
      break;

    case 'register-user-referral': // register user referral
      const { person_name: clientName } = options;
      templateContent = fs.readFileSync(templatePathRegisterUserReferral, 'utf-8');
      templateContent = templateContent.replace('{{person_name}}', clientName);
      break;

    case 'notification-admin-sysplt': // notification admin sysplt
      templateContent = fs.readFileSync(templatePathNotificationAdminSysplt, 'utf-8');
      break;

    case 'notification-client-service-request': // notification client service request
      templateContent = fs.readFileSync(templatePathNotificationClientServiceRequest, 'utf-8');
      break;

    case 'notification-payment-commision': // notification payment commision
      templateContent = fs.readFileSync(templatePathNotificationPaymentCommision, 'utf-8');
      break;

    case 'notification-request-generated': // notification request generated
      templateContent = fs.readFileSync(templatePathNotificationRequestGenerated, 'utf-8');
      const { referral_name, client_name, order_number } = options;
      templateContent = templateContent
        .replace('{{referral_name}}', referral_name)
        .replace('{{client_name}}', client_name)
        .replace('{{order_number}}', order_number);
      break;

    case 'notification-request-generated-client': // notification request generated client
      templateContent = fs.readFileSync(templatePathNotificationRequestGeneratedClient, 'utf-8');
      const { customer_names, customer_order_number } = options;
      templateContent = templateContent
        .replace('{{customer_names}}', customer_names)
        .replace('{{customer_order_number}}', customer_order_number)
        .replace('{{contact_email}}', contactEmail);
      break;

    case 'notification-update-request': // notification update request
      templateContent = fs.readFileSync(templatePathNotificationUpdateRequest, 'utf-8');
      const { referral_name: refName, order_number: orderNum, new_status } = options;
      let statusVerbText = new_status.toLowerCase() === 'terminada'
        ? '¡Excelente noticia! La orden de servicio ha sido <strong>finalizada con éxito</strong>. Esto significa que tu gestión como referente ha culminado de manera positiva y el proceso de comisión sigue su curso.'
        : new_status.toLowerCase() === 'no aprobada'
          ? 'Queremos informarte que la orden de servicio de tu referido en SIO ha cambiado de estado y no se ha podido culminar el proceso con éxito.'
          : 'Queremos informarte que la orden de servicio de tu referido en SIO ha cambiado de estado y sigue avanzando en el proceso.'
      let statusComplementText = new_status.toLowerCase() === 'terminada'
        ? 'Si tienes nuevos referidos en mente o alguna duda sobre tus pagos, no dudes en contactar a nuestro equipo de ventas. ¡Vamos por más!'
        : new_status.toLowerCase() === 'no aprobada'
          ? 'En esta ocasión, no se ha podido culminar el proceso de la orden de servicio con éxito. Sin embargo, ¡no te desanimes! En el mundo de las ventas, cada experiencia nos prepara para el próximo gran cierre.'
          : 'Nuestro equipo está trabajando para completar tu solicitud lo antes posible. Si tienes alguna duda sobre este proceso, no dudes en contactar a nuestro equipo de ventas.'

      templateContent = templateContent
        .replace('{{referral_name}}', refName)
        .replace('{{order_number}}', orderNum)
        .replace('{{new_status}}', new_status)
        .replace('{{status_verb}}', statusVerbText)
        .replace('{{status_complement}}', statusComplementText);
      break;

    case 'notification-update-request-client': // notification update request client
      templateContent = fs.readFileSync(templatePathNotificationUpdateRequestClient, 'utf-8');
      const { updateServiceCustomerName, updateServiceOrderNumber, updateServiceNewStatus } = options;
      let UpdateServiceStatusComplementText = updateServiceNewStatus.toLowerCase() === 'terminada'
        ? '¡Felicidades! Tu servicio ha sido instalado exitosamente. Esperamos que disfrutes de la mejor experiencia de conectividad con nosotros. Si necesitas asistencia adicional o tienes dudas sobre el funcionamiento, nuestro equipo de soporte técnico estará encantado de ayudarte. Contáctanos al correo electrónico ' + contactEmail + '.'
        : updateServiceNewStatus.toLowerCase() === 'no aprobada'
          ? 'En esta ocasión, no ha sido posible culminar el proceso de instalación de tu servicio. Agradecemos tu interés en SIO y te invitamos a contactar a nuestro equipo de atención para explorar otras ofertas o tecnologías disponibles que puedan adaptarse a tu necesidad.'
          : 'Nuestro equipo operativo está trabajando para avanzar con tu solicitud lo antes posible. Te mantendremos informado sobre cualquier novedad adicional. Si tienes alguna duda sobre tu proceso, no dudes en contactar a nuestro equipo de atención al cliente al correo electrónico ' + contactEmail;

      templateContent = templateContent
        .replace('{{update_service_customer_name}}', updateServiceCustomerName)
        .replace('{{update_service_order_number}}', updateServiceOrderNumber)
        .replace('{{update_service_new_status}}', updateServiceNewStatus)
        .replace('{{update_service_status_complement}}', UpdateServiceStatusComplementText);
      break;

    case 'recovery-password':
      templateContent = fs.readFileSync(templatePathRecoveryPassword, 'utf-8');
      const { user_name, reset_link } = options;
      templateContent = templateContent
        .replace('{{user_name}}', user_name)
        .replace('{{reset_link}}', reset_link);
      break;

    case 'notification-referral-request-payment-commision':
      templateContent = fs.readFileSync(templatePathNotificationReferralRequestPaymentCommision, 'utf-8');
      const { referredName, amount, guideCode } = options;
      templateContent = templateContent
        .replace('{{referred_name}}', referredName)
        .replace('{{amount}}', amount)
        .replace('{{guide_code}}', guideCode);
      break;

    case 'notification-referral-request-payment-bonus':
      templateContent = fs.readFileSync(templatePathNotificationReferralRequestPaymentBonus, 'utf-8');
      const { auxBonusReferredName, auxBonusAmount, auxBonusGuideCode } = options;

      // 1. Generamos el HTML para la lista de guías
      const auxBonusGuideCodesHtml = Array.isArray(auxBonusGuideCode)
        ? auxBonusGuideCode.map(code => `<li style="margin-bottom: 4px;">${code}</li>`).join('')
        : `<li style="margin-bottom: 4px;">${auxBonusGuideCode}</li>`;

      templateContent = templateContent
        .replace('{{bonus_referred_name}}', auxBonusReferredName)
        .replace('{{bonus_amount}}', auxBonusAmount)
        .replace('{{bonus_guide_list}}', auxBonusGuideCodesHtml);
      break;

    case 'notification-to-admin-request-payment-commision':
      templateContent = fs.readFileSync(templatePathNotificationToAdminRequestPaymentCommision, 'utf-8');
      const { auxReferredName, auxAmount, auxGuideCode } = options;
      templateContent = templateContent
        .replace('{{referred_name}}', auxReferredName)
        .replace('{{amount}}', auxAmount)
        .replace('{{guide_code}}', auxGuideCode);
      break;

    case 'notification-to-admin-request-payment-bonus':
      templateContent = fs.readFileSync(templatePathNotificationToAdminRequestPaymentBonus, 'utf-8');
      const { bonusReferredName, bonusAmount, bonusGuideCode } = options;
      // 1. Generamos el HTML para la lista de guías
      const guidesHtml = Array.isArray(bonusGuideCode)
        ? bonusGuideCode.map(code => `<li style="margin-bottom: 4px;">${code}</li>`).join('')
        : `<li style="margin-bottom: 4px;">${bonusGuideCode}</li>`;

      templateContent = templateContent
        .replace('{{referred_name}}', bonusReferredName)
        .replace('{{amount}}', bonusAmount)
        .replace('{{guide_list}}', guidesHtml);
      break;

    case 'notification-to-referral-paid-commision':
      templateContent = fs.readFileSync(templatePathNotificationToReferralPaidCommision, 'utf-8');
      const { paidReferredName, paidAmount, paidGuideCode, bankName } = options;
      templateContent = templateContent
        .replace('{{referral_name}}', paidReferredName)
        .replace('{{amount}}', paidAmount)
        .replace('{{guide_code}}', paidGuideCode)
        .replace('{{bank_name}}', bankName)
        .replace('{{referral_name_paid}}', paidReferredName);
      break;
  }

  try {
    const logoPath = path.join(__dirname, 'email-templates', './image/SIO-logo.png');
    const logoBase64 = fs.readFileSync(logoPath).toString('base64');
    const result = await resend.emails.send({
      from: 'SIO App <no-reply@siocolombia.com>',
      to: email,
      subject: subject,
      html: templateContent,
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
};

// GET USER SYSTEM ENV 
export const getUserSystemEnv = () => {
  return process.env.EMAILS_SYS;
};

// RESET PASSWORD PROCESS
export const generateResetToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

export const hashValue = async (value) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(value, salt);
};

