import { NotificationChannels } from "./notification.types.js";
import { sendEmail } from "./providers/email.provider.js";
import { sendSMS } from "./providers/sms.provider.js";
import { sendWhatsApp } from "./providers/whatsapp.provider.js";

export const sendNotification = async ({
 channel,
 to,
 subject,
 message,
 html,
 metadata = {},
}) => {
 try {
  switch (channel) {
   case NotificationChannels.EMAIL:
    return await sendEmail({ to, subject, html });

   case NotificationChannels.SMS:
    return await sendSMS({ to, message });

   case NotificationChannels.WHATSAPP:
    return await sendWhatsApp({ to, message });

   default:
    throw new Error("Canal de notificación no soportado.");
  }
 } catch (error) {
  console.error("Notification Error:", error);

  // Aquí puedes guardar log en DB para auditoría SaaS
  // await logNotificationError(metadata, error);

  throw error;
 }
};

/*
Ejemplo de como usar el servicio de notificaciones:

import { sendNotification } from "./notification.service.js";
import { NotificationChannels } from "./notification.types.js";

await sendNotification({
 channel: NotificationChannels.EMAIL,
 to: "[EMAIL_ADDRESS]",
 subject: "Notificación de prueba",
 message: "Este es un mensaje de prueba.",
 html: "<h1>Este es un mensaje de prueba.</h1>",
 metadata: {
  userId: 1,
  type: "test",
 },
});
*/