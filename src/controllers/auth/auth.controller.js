import jwt from "jsonwebtoken";
import pool from "../../config/db.config.js";
import authConfig from "../../config/auth.config.js";
import { comparePassword } from "../../utils/password.js";
import { generateToken } from "../../utils/shared.js";
// import { getTokenByReq } from "../common/common.controller.js";
import dotenv from "dotenv";
import { token } from "morgan";
// import { sendNotification } from "../../services/notification.service.js";
// import { NotificationChannels } from "../../modules/notifications/notification.types.js";
// import { verifyOTP } from "../../modules/notifications/providers/otp.provider.js";
dotenv.config();

// SignIn
export const signIn = (req, res) => {
  console.log("SignIn.Track: req.body", req.body);
  const { username, password } = req.body;
  console.log("SignIn.Track: username", username);
  console.log("SignIn.Track: password", password);
  if (!username || !password) {
    console.log("SignIn.Track: No username or password");
    return res
      .status(400)
      .json({ message: "Usuario y contraseña son obligatorios." });
  }

  pool.query(
    "SELECT * FROM users WHERE username = $1",
    [username],
    async (err, result) => {
      if (err) {
        console.log("SignIn.Track: Error al consultar usuario");
        return res.status(500).json({ message: "Error al consultar usuario." });
      }
      if (result.rows.length === 0) {
        console.log("SignIn.Track: Usuario no encontrado");
        return res
          .status(401)
          .json({ message: "Usuario o contraseña invalidos." });
      }
      const user = result.rows[0];
      if (!user.is_active) {
        console.log("SignIn.Track: Usuario no activo");
        return res.status(401).json({ message: "Usuario no activo." });
      }

      const isPasswordValid = await comparePassword(password, user.password);
      if (!isPasswordValid) {
        console.log("SignIn.Track: Contraseña invalida");
        return res
          .status(401)
          .json({ message: "Usuario o contraseña invalidos." });
      }
      const token = generateToken(user.id);
      console.log("SignIn.Track: token", token);
      console.log("SignIn.Track: process.env.NODE_ENV", process.env.NODE_ENV);
      res.cookie("token", token, {
        httpOnly: true,
        secure: true, //process.env.NODE_ENV === "production", // En prod SOLO con https
        sameSite: "none", //process.env.NODE_ENV === "production" ? "none" : "strict", // 👈 strict: para seguridad
        maxAge: 60 * 60 * 1000, // 1 hora
      });
      console.log("SignIn.Track: Token cookie set");
      console.log("SignIn.Track: res.cookie", res.cookie);

      // SEND sms
      // const smsResult = await sendNotification({
      //   channel: NotificationChannels.SMS,
      //   to: "+573007858634",
      //   subject: "Hola Ricardo, este es un mensaje de prueba del sistema SIO.",
      //   message: `SIO|Colombia, tu sesión ha sido iniciada exitosamente.`,
      //   metadata: {
      //     userId: user.id,
      //     type: "login",
      //   },
      // });
      // console.log("SMS Result:", smsResult);

      // SEND whatsapp
      // const whatsappResult = await sendNotification({
      //   channel: NotificationChannels.WHATSAPP,
      //   to: "+573007858634",
      //   subject: "Hola Ricardo, este es un mensaje de prueba del sistema SIO.",
      //   message: `Tu sesión ha sido iniciada exitosamente.`,
      //   metadata: {
      //     userId: user.id,
      //     type: "login",
      //   },
      // });
      // console.log("WhatsApp Result:", whatsappResult);

      // SEND OTP
      // const otpResult = await sendNotification({
      //   channel: NotificationChannels.OTP,
      //   to: "+573007858634",
      //   metadata: {
      //     userId: user.id,
      //     type: "login",
      //   },
      // });
      // console.log("OTP Result:", otpResult);

      // VERIFY OTP
      // const verifyOtpResult = await verifyOTP({
      //   to: "+573007858634",
      //   code: "235012",
      // });
      // console.log("Verify OTP Result:", verifyOtpResult);

      res.json({
        process: "success",
        message: "Inicio de sesión exitoso.",
        token: token
      });
    }
  );
};

// Get data for the session
export const getSessionData = (req, res) => {

  console.log("---------------SESSION DATA LOG TRACK-----------------");
  console.log("GetSessionData.Track: req", req);
  console.log("--------------------------------");
  console.log("GetSessionData.Track: req.cookies", req.cookies);
  console.log("--------------------------------");
  console.log("GetSessionData.Track: req.cookies.token", req.cookies.token);
  console.log("--------------------------------");
  console.log("GetSessionData.Track: req.user", req.user);
  console.log("--------------------------------");
  console.log("---------------SESSION DATA LOG TRACK-----------------");
  // const tokenData = getTokenByReq(req);
  // if (tokenData.process !== "success") {
  //   return res.status(401).json({
  //     process: tokenData.process,
  //     message: tokenData.message
  //   });
  // }
  // const token = tokenData.token;

  // const token = req.cookies.token;
  if (!token) { // No encontró token
    console.log("GetSessionData.Track: No token");
    return res.status(401).json({ message: "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando." });
  }
  jwt.verify(token, authConfig.secret, (err, decoded) => {
    if (err) { // Token inválido
      console.log("GetSessionData.Track: Invalid token");
      return res.status(401).json({ message: "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad." });
    }
    // Consultar person by user_id
    pool.query(
      "SELECT * FROM persons WHERE id = (SELECT person_id FROM users WHERE id = $1)",
      [decoded.id],
      (err, result) => {
        if (err) {
          console.log("GetSessionData.Track: Error al consultar persona");
          return res.status(500).json({ message: "Error al consultar datos de la persona." });
        }
        if (result.rows.length === 0) {
          console.log("GetSessionData.Track: Persona no encontrada");
          return res.status(401).json({ message: "Persona no encontrada." });
        }
        const person = result.rows[0];

        // Consultar roles by user_id
        pool.query(
          "SELECT * FROM roles WHERE id = (SELECT role_id FROM user_roles WHERE user_id = $1)",
          [decoded.id],
          (err, result) => {
            if (err) {
              console.log("GetSessionData.Track: Error al consultar rol");
              return res.status(500).json({ message: "Error al consultar datos del rol asociado al usuario." });
            }
            if (result.rows.length === 0) {
              console.log("GetSessionData.Track: Rol no encontrado");
              return res.status(401).json({ message: "Rol asociado al usuario no encontrado." });
            }
            const roles = result.rows;
            console.log("GetSessionData.Track: Roles", roles);

            res.json({
              process: "success",
              message: "Datos para la sesion obtenidos exitosamente.",
              data: {
                username: decoded.username,
                role_id: roles[0].id,
                role_name: roles[0].name,
                person: {
                  first_name: person.name,
                  middle_name: person.middle_name,
                  last_name: person.last_name,
                  document: person.document,
                  email: person.email,
                }
                // user: decoded,
                // person,
                // roles,
              },
            });
          }
        );
      }
    );
  });
};

// SignOut
export const signOut = (req, res) => {
  res.clearCookie("token");
  res.json({
    process: "success",
    message: "Sesion cerrada exitosamente.",
  });
};

