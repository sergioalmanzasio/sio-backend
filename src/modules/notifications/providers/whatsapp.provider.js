import axios from "axios";

export const sendWhatsApp = async ({ to, message }) => {
 return axios.post(
  process.env.WHATSAPP_API_URL,
  {
   to,
   message,
  },
  {
   headers: {
    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
   },
  }
 );
};