import jwt from "jsonwebtoken";
import pool from "../../config/db.config.js";
import authConfig from "../../config/auth.config.js";
import { comparePassword, hashPassword } from "../../utils/password.js";
import { generateToken, generateResetToken, hashValue, sendEmailV2 } from "../../utils/shared.js";
import { getTokenByReq } from "../common/common.controller.js";
import dotenv from "dotenv";
import { logger } from "../../utils/logger.js";
import bcrypt from "bcrypt";
import { token } from "morgan";
// import { sendNotification } from "../../services/notification.service.js";
// import { NotificationChannels } from "../../modules/notifications/notification.types.js";
// import { verifyOTP } from "../../modules/notifications/providers/otp.provider.js";
dotenv.config();

// SIGN IN
export const signIn = (req, res) => {
  const { username, password } = req.body;
  pool.query(
    "SELECT * FROM users WHERE username = $1",
    [username],
    (err, result) => {
      if (err) {
        logger.error("AuthController.signIn - error to query user", {
          error: err.message,
          username: username
        });
        return res.status(500).json({
          process: "info",
          message: "Se presentó un inconveniente al consultar el usuario, intente nuevamente."
        });
      }
      if (result.rows.length === 0) {
        logger.error("AuthController.signIn - user not found", {
          username: username
        });
        return res.status(401).json({
          process: "info",
          message: "Usuario o contraseña invalidos."
        });
      }
      const user = result.rows[0];

      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) {
          logger.error("AuthController.signIn - error to compare password", {
            error: err.message,
            username: username
          });
          return res.status(500).json({
            process: "info",
            message: "Usuario o contraseña invalidos."
          });
        }
        if (!isMatch) {
          logger.error("AuthController.signIn - password not match", {
            username: username
          });
          return res.status(401).json({
            process: "info",
            message: "Usuario o contraseña invalidos."
          });
        }
        const token = generateToken(user.id);
        res.json({
          process: "success",
          message: "Inicio de sesión exitoso.",
          token: token
        });
      });
    }
  );
};

// GET SESSION DATA
export const getSessionData = (req, res) => {
  const userID = req.user.id;
  pool.query(
    `SELECT prs.*, usr.username AS username 
      FROM persons prs 
      LEFT JOIN users usr ON usr.person_id = prs.id
      WHERE usr.id = $1`,
    [userID],
    (err, resultDataPerson) => {
      if (err) {
        logger.error("AuthController.getSessionData - error to query person", {
          error: err.message,
          userId: userID
        });
        return res.status(500).json({
          process: "info",
          message: "Se presentó un inconveniente al consultar los datos de la persona, intente nuevamente."
        });
      }
      if (resultDataPerson.rows.length === 0) {
        logger.error("AuthController.getSessionData - person not found", {
          userId: userID
        });
        return res.status(401).json({
          process: "info",
          message: "Lo sentimos, no fue posible obtener la información del usuario, intente nuevamente."
        });
      }
      const person = resultDataPerson.rows[0];

      pool.query(
        `SELECT rol.* 
          FROM roles rol 
          LEFT JOIN user_roles usr ON usr.role_id = rol.id 
          WHERE usr.user_id = $1`,
        [userID],
        (err, result) => {
          if (err) {
            logger.error("AuthController.getSessionData - error to query role", {
              error: err.message,
              userId: userID
            });
            return res.status(500).json({
              process: "info",
              message: "Lo sentimos, no fue posible obtener la información del usuario, intente nuevamente."
            });
          }
          if (result.rows.length === 0) {
            logger.error("AuthController.getSessionData - role not found", {
              userId: userID
            });
            return res.status(401).json({
              process: "info",
              message: "Lo sentimos, no fue posible obtener la información del usuario, intente nuevamente."
            });
          }
          const roles = result.rows;
          let options = [];
          pool.query(
            `SELECT op."name", op.url 
                    FROM role_options_app roa 
                    JOIN roles rl ON roa.role_id = rl.id 
                    JOIN options_app op ON op.id = roa.option_id 
                    WHERE roa.role_id = $1 AND roa.is_active = TRUE order by op.order_number`,
            [roles[0].id],
            (err, result) => {
              if (err) {
                logger.error("AuthController.getSessionData - error to query options", {
                  error: err.message,
                  userId: userID
                });
              }
              options = result.rows;
              res.json({
                process: "success",
                message: "Datos para la sesión obtenidos exitosamente.",
                data: {
                  username: person.username,
                  role_id: roles[0].id,
                  role_name: roles[0].name,
                  person: {
                    first_name: person.name,
                    middle_name: person.middle_name,
                    last_name: person.last_name,
                    document: person.document,
                    email: person.email,
                  },
                  options: options,
                },
              });
            }
          );

        }
      );
    }
  );
};

// SIGN OUT
export const signOut = (req, res) => {
  return res.status(200).json({
    process: "success",
    message: "Sesión cerrada correctamente."
  });
};

// *** UPDATE TOKEN
export const updateToken = (req, res) => {
  const newToken = generateToken(req.user.id);
  res.json({
    process: "success",
    message: "Token actualizado exitosamente.",
    token: newToken,
  });
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        process: "error",
        message: "El correo es requerido.",
      });
    }

    // 1. Buscar usuario
    const userResult = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [email]
    );

    // 🔐 Siempre responder lo mismo (seguridad)
    if (userResult.rows.length === 0) {
      logger.error("AuthController.forgotPassword - User not found", {
        email: email
      });
      return res.status(200).json({
        process: "success",
        message: "Si el correo existe, recibirás instrucciones.",
      });
    }

    const userId = userResult.rows[0].id;

    const personResult = await pool.query(
      `SELECT prs.name || ' ' || COALESCE(prs.middle_name, '') || ' ' || prs.last_name AS user_name 
        FROM users usr 
        LEFT JOIN persons prs ON prs.id = usr.person_id
        WHERE usr.id = $1`,
      [userId]
    );

    if (personResult.rows.length === 0) {
      logger.error("AuthController.forgotPassword - Person not found", {
        userId: userId
      });
      return res.status(401).json({
        process: "info",
        message: "Lo siento, no se encontró información de la persona.",
      });
    }
    const person = personResult.rows[0];

    // 2. Invalidar tokens anteriores
    await pool.query(
      "DELETE FROM password_resets WHERE user_id = $1",
      [userId]
    );

    // 3. Generar token
    const token = generateResetToken();
    const tokenHash = await hashValue(token);

    // 4. Expiración (10 min)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // 5. Guardar en DB
    await pool.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );

    // 6. Link
    const resetLink = `${process.env.APP_URL}/reset-password?token=${token}`;

    // 7. Enviar email (usa tu servicio)
    await sendEmailV2(
      email,
      "Recuperación de contraseña",
      "recovery-password",
      {
        user_name: person.user_name,
        reset_link: resetLink,
      }
    );

    return res.status(200).json({
      process: "success",
      message: "Si el correo existe, recibirás instrucciones.",
    });

  } catch (error) {
    logger.error("AuthController.forgotPassword - Global error", {
      error: error.message,
      email: email
    });
    return res.status(500).json({
      process: "error",
      message: "Error al procesar la solicitud.",
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({
        process: "error",
        message: "Datos incompletos.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        process: "error",
        message: "Las contraseñas no coinciden.",
      });
    }

    // 1. Buscar tokens válidos
    const result = await pool.query(
      `SELECT * FROM password_resets 
       WHERE expires_at > NOW() AND used = FALSE`
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        process: "error",
        message: "Token inválido o expirado.",
      });
    }

    let validRecord = null;

    // 2. Comparar token con hash
    for (const record of result.rows) {
      const isMatch = await bcrypt.compare(token, record.token_hash);
      if (isMatch) {
        validRecord = record;
        break;
      }
    }

    if (!validRecord) {
      return res.status(400).json({
        process: "error",
        message: "Token inválido o expirado, por favor intente solicitar el enlace de recuperación nuevamente.",
      });
    }

    // 3. Hashear nueva contraseña
    const hashedPassword = await hashPassword(newPassword);

    // 4. Actualizar usuario
    await pool.query(
      "UPDATE users SET password = $1 WHERE id = $2",
      [hashedPassword, validRecord.user_id]
    );

    // 5. Marcar token como usado
    await pool.query(
      "UPDATE password_resets SET used = TRUE WHERE id = $1",
      [validRecord.id]
    );

    return res.status(200).json({
      process: "success",
      message: "Contraseña actualizada correctamente.",
    });

  } catch (error) {
    logger.error("AuthController.resetPassword - Global error", {
      error: error.message,
      token: token
    });
    return res.status(500).json({
      process: "error",
      message: "Error al restablecer la contraseña.",
    });
  }
};

//! SIGN IN DEPRECATED
export const signInDeprecated = (req, res) => {
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

//! GET SESSION DATA DEPRECATED
export const getSessionDataDeprecated = (req, res) => {

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
  const tokenData = getTokenByReq(req);
  if (tokenData.process !== "success") {
    return res.status(401).json({
      process: tokenData.process,
      message: tokenData.message
    });
  }
  const token = tokenData.token;

  // const token = req.cookies.token;
  if (!token) { // No encontró token
    console.log("GetSessionData.Track: No token");
    return res.status(401).json({ message: "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando." });
  }
  jwt.verify(token, authConfig.secret, (err, decoded) => {
    if (err) { // Token inválido
      return res.status(401).json({
        process: "info",
        message: "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad."
      });
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



// *** Refactor function signIn and getSessionData, req.header.authorization instead of req.cookies.token
// *** get data user.id from req.user




