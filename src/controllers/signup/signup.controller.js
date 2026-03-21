import pool from "../../config/db.config.js";
import { hashPassword } from "../../utils/password.js";
import { sendEmail, sendEmailV2 } from "../../utils/shared.js";
import jwt from "jsonwebtoken";
import authConfig from "../../config/auth.config.js";
import { validatePersonExistByDocumentEmailPhone, validateUserExist, validateCodeAndExpiresAt, getDocumentTypeIdByAcronym, createPersonLocation, createUserAccount, isPersonHasUserByDocument } from "../common/common.controller.js";

import { generateToken, transversalUUID, generateVerificationCode, getExpirationDate, } from "../../utils/shared.js";
import dotenv from "dotenv";
import { logger } from "../../utils/logger.js";
dotenv.config();

//*** SignUp ***
//*** Para realizar este proceso, debio primero validarse si ya existe un usuario con el correo enviado y una persona con el número de documento enviado. 
//*** Si no existe, se procede a crear el usuario y la persona.
//*** SC-AC-001: Crear usuario y persona
export const signUp = async (req, res) => {
  const {
    document, document_type_acronym, name, middle_name, last_name, email, phone, password,
    roleName, // referral, client, assistant
    bankName,
    accountNumber,
    // isAssistant,
  } = req.body;

  if (roleName == 'client') {
    if (!document || !document_type_acronym || !name || !last_name || !email || !phone || !accountNumber) {
      return res.status(400).json({ message: "Todos los campos son obligatorios." });
    }
  } else {
    if (
      !document || !document_type_acronym || !name || !last_name || !email || !phone || !password || !roleName || !bankName ||
      !accountNumber
      // isAssistant === undefined
    ) {
      return res
        .status(400)
        .json({ message: "Todos los campos son obligatorios." });
    }
  }

  if (roleName === 'referral') {
    const isPersonHasUser = await isPersonHasUserByDocument(document);
    if (isPersonHasUser.process) {
      if (isPersonHasUser.exists_in_person === 'SI' && isPersonHasUser.exists_in_user === 'NO') {
        return res.status(400).json({
          process: "error",
          message: "Esta persona ya está registrada como cliente y no puede asociarse como referido."
        });
      }
    }
  }

  const username = email;
  const documentType = await getDocumentTypeIdByAcronym(document_type_acronym);
  if (documentType.process === "error") {
    // TD-001: Error con obtención de ID de Tipo documento
    logger.error(`SignupController.signUp: Error al obtener el ID del tipo de documento.`, {
      document,
      document_type_acronym,
    });
    return res.status(400).json({
      process: "error",
      message: "Se ha presentado un inconveniente y no se pudo realizar el registro (TD-001)"
    });
  }

  pool.query(
    "INSERT INTO persons (document, document_type_id, name, middle_name, last_name, email, phone, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
    [
      document,
      documentType.id,
      name,
      middle_name,
      last_name,
      email,
      phone,
      transversalUUID(),
      transversalUUID(),
    ],
    async (err, result) => {
      if (err) {
        return res.status(500).json({ process: "error", message: "Error al crear persona." });
      }

      const createPersonLocationResult = await createPersonLocation(result.rows[0].id, 'Pendiente', 'Pendiente', 'Pendiente', 'Pendiente', 'Pendiente', transversalUUID());
      if (createPersonLocationResult.process === "error") {
        logger.error(`SignupController.signUp: Error al crear ubicación de persona.`, {
          document,
          document_type_acronym,
          name,
          middle_name,
          last_name,
          email,
          phone,
          password,
          roleName,
          bankName,
          accountNumber,
          createPersonLocationResult,
        });
        // return res.status(500).json({ process: "error", message: "Error al crear ubicación de persona." });
      }

      const person_id = result.rows[0].id;
      let isActive = roleName === 'assistant' ? false : true;

      // Create user
      const hash = await hashPassword(password);
      pool.query(
        "INSERT INTO users (person_id, username, password, is_active, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [
          person_id,
          username,
          hash,
          isActive,
          transversalUUID(),
          transversalUUID(),
        ],
        async (err, result) => {
          if (err) {
            return res.status(500).json({ message: "Error al crear usuario." });
          }
          const user_id = result.rows[0].id;
          const createUserAccountResult = await createUserAccount(user_id, bankName, accountNumber, transversalUUID());
          if (createUserAccountResult.process === "error") {
            logger.error(`SignupController.signUp: Error al crear cuenta de usuario.`, {
              user_id,
              bankName,
              accountNumber,
              createUserAccountResult,
            });
          }

          await pool.query(
            "UPDATE persons SET created_by = $1, updated_by = $2 WHERE id = $3",
            [user_id, user_id, person_id]
          );

          // const roleName = isAssistant ? "assistant" : "client";
          pool.query(
            "SELECT * FROM roles WHERE name = $1",
            [roleName],
            async (err, result) => {
              if (err) {
                logger.error(`SignupController.signUp: Error al consultar rol.`, {
                  document,
                  document_type_acronym,
                  name,
                  middle_name,
                  last_name,
                  email,
                  phone,
                  password,
                  roleName,
                  bankName,
                  accountNumber,
                });
                return res.status(500).json({
                  process: "error",
                  message: "Error al consultar rol."
                });
              }
              if (result.rows.length === 0) {
                return res.status(401).json({
                  process: "error",
                  message: "Rol no encontrado."
                });
              }
              const role_id = result.rows[0].id;

              pool.query(
                "INSERT INTO user_roles (user_id, role_id, created_by, updated_by) VALUES ($1, $2, $3, $4)",
                [user_id, role_id, user_id, user_id]
              );

              if (roleName === 'assistant' || roleName === 'referral') {
                // Generate code with length 6 by 
                // SUBSTRING(gen_random_uuid()::text FROM 1 FOR 6)
                pool.query(
                  `INSERT INTO referral_codes (seller_user_id, code, created_by) 
                  VALUES ($1, SUBSTRING(gen_random_uuid()::text FROM 1 FOR 6), $2)`,
                  [user_id, user_id],
                  (err, result) => {
                    if (err) {
                      console.log('Error al crear código de referido.', err);
                    }
                  }
                )
              }

              // TODO: refactorizar condición para manejar role referral
              if (roleName === 'assistant') {
                const sendEmailRegisterUserAssistant = await sendEmail(email, 'SIO - Bienvenido a SIO', '000000', name, '', 'register-user-assistant');
                if (!sendEmailRegisterUserAssistant) {
                  return res.status(500).send({
                    process: "error",
                    message: "Error al enviar correo de bienvenida a SIO al asesor.",
                  });
                }
                const sendEmailNotificationAdminSysplt = await sendEmail(email, 'SIO - Activación de usuario vendedor', '000000', name, username, 'notification-admin-sysplt');
                if (!sendEmailNotificationAdminSysplt) {
                  return res.status(500).send({
                    process: "error",
                    message: "Error al enviar correo de bienvenida a SIO al asesor.",
                  });
                }
              } else {
                const sendEmailRegisterUserClient = await sendEmailV2(email, 'SIO Colombia - Bienvenido(a)', 'register-user-referral', { person_name: name });
                if (!sendEmailRegisterUserClient) {
                  logger.error(`Error al enviar correo de bienvenida a SIO al cliente.`,
                    {
                      email,
                      person_name: name
                    }
                  );
                }
              }

              const token = generateToken(username);
              res.cookie("token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production", // En prod SOLO con https
                sameSite: "strict",
                maxAge: 60 * 60 * 1000, // 1 hora
              });
              res.json({
                process: "success",
                message: roleName === 'assistant'
                  ? "Usuario creado exitosamente, entrará en un proceso de aprobación y le notificaremos cuando se active."
                  : "Bienvenido(a) a SIO. Ahora puede iniciar sesión.",
              });
            }
          );


        }
      );
    }
  );
};

// SignUp | Generate code
export const signUpGenerateCode = async (req, res) => {
  const { email, document, name, phone } = req.body;
  if (!email || !document || !name || !phone) {
    return res
      .status(400)
      .json({ message: "Todos los campos son obligatorios." });
  }

  // Validate if email or document already exists
  const validatePersonExist = await validatePersonExistByDocumentEmailPhone(document, email, phone);
  if (validatePersonExist.process === "error") {
    return res.status(400).json({
      process: "error",
      message: "El documento, correo electrónico o teléfono ya están registrados."
    });
  }

  // Validate if email have code and expiresAt
  const validateCodeAndExpires = await validateCodeAndExpiresAt(email);
  if (validateCodeAndExpires.process === "error") {
    return res.status(400).json({
      process: "error",
      message: 'Tiene un código de verificación activo, intente nuevamente en unos minutos.'
    });
  }

  const code = generateVerificationCode();

  // Save code in database
  pool.query(
    "INSERT INTO signup_code (email, code) VALUES ($1, $2)",
    [email, code],
    async (err, result) => {
      if (err) {
        console.log('Error al generar código.', err);
        return res
          .status(500)
          .json({
            process: "error",
            message: "Error al generar código. intentelo de nuevo."
          });
      }

      // const resultSendMail = await sendEmail(email, 'SIO - Código de verificación', code, name, email, 'user-registration');
      const resultSendMail = await sendEmailV2(email, 'SIO Colombia - Código de verificación', 'user-registration',
        {
          person_name: name,
          code: code,
        });
      if (!resultSendMail) {
        logger.error(`SignupController.signUpGenerateCode: Error al enviar correo de verificación.`, {
          email,
          person_name: name,
          code: code,
        });
        return res.status(500).json({
          process: "info",
          message: 'Lo sentimos, no se pudo enviar el correo de verificación, por favor intente nuevamente.'
        });
      }

      // Send email with code to user for registration
      // const sendEmailSignUpCode = await sendEmail(email, 'SIO - Código de verificación', code, name, email, 'user-registration');
      // console.log('Log tracking (signup.controller.js - signUpGenerateCode): ', sendEmailSignUpCode);

      // if (!sendEmailSignUpCode) {
      //   return res.status(500).send({
      //     process: "error",
      //     message: "Error al enviar correo del código de registro.",
      //   });
      // }
      return res
        .status(200)
        .json({
          process: "success",
          code,
          message: `Código generado y enviado al correo electrónico ${email}.`
        });
    }
  );
};

// SignUp | Verify code
export const signUpVerifyCode = async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res
      .status(400)
      .json({ message: "Todos los campos son obligatorios." });
  }

  // Verify code
  const validateCodeAndExpires = await pool.query(
    "SELECT * FROM signup_code WHERE email = $1 AND code = $2 AND expires_at > NOW()",
    [email, code]
  );

  if (validateCodeAndExpires.rows.length === 0) {
    return res
      .status(400)
      .json({ message: "Código inválido." });
  }

  // Update is_used to true
  const updateCodeAndExpires = await pool.query(
    "UPDATE signup_code SET is_used = $1 WHERE email = $2 AND code = $3 AND expires_at > NOW() RETURNING *",
    [true, email, code]
  );

  if (updateCodeAndExpires.rows.length === 0) {
    return res
      .status(400)
      .json({ message: "Código inválido." });
  }

  return res
    .status(200)
    .json({ message: "Código verificado exitosamente." });

};

// Register internal user
// Entran datos de person(document,document_type_id,name,middle_name,last_name,email,phone,), role_id, password
export const registerInternalUser = async (req, res) => {
  const { document, document_type_id, name, middle_name, last_name, email, phone, role_id, password } = req.body;
  if (!document || !document_type_id || !name || !last_name || !email || !phone || !role_id || !password) {
    return res
      .status(400)
      .json({ message: "Todos los campos son obligatorios." });
  }
  const hash = await hashPassword(password);
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({
      process: "session-expired",
      message:
        "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando.",
    });
  }
  jwt.verify(token, authConfig.secret, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
      });
    }

    validatePersonExistByDocumentEmailPhone(document, email, phone)
      .then((validatePersonExist) => {
        if (validatePersonExist.process === "error") {
          return res.status(400).json({ message: validatePersonExist.message });
        }
      })
      .catch((error) => {
        console.log(error);
        return res.status(500).json({ message: "Error al validar persona." });
      })

    validateUserExist(email)
      .then((validateUserExist) => {
        if (validateUserExist.process === "error") {
          return res.status(400).json({ message: validateUserExist.message });
        }
      })
      .catch((error) => {
        console.log(error);
        return res.status(500).json({ message: "Error al validar usuario." });
      })

    const username = email;
    const isActive = true;
    const created_by = transversalUUID();
    const updated_by = transversalUUID();

    // insert person
    pool.query(
      "INSERT INTO persons (document, document_type_id, name, middle_name, last_name, email, phone, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
      [document, document_type_id, name, middle_name, last_name, email, phone, created_by, updated_by],
      async (err, result) => {
        if (err) {
          return res.status(500).json({ message: "Error al crear persona." });
        }
        const person_id = result.rows[0].id;
        // insert user
        pool.query(
          "INSERT INTO users (person_id, username, password, is_active, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
          [person_id, username, hash, isActive, created_by, updated_by],
          async (err, result) => {
            if (err) {
              return res.status(500).json({ message: "Error al crear usuario." });
            }
            const user_id = result.rows[0].id;
            // insert user_role
            pool.query(
              "INSERT INTO user_roles (user_id, role_id, created_by, updated_by) VALUES ($1, $2, $3, $4)",
              [user_id, role_id, created_by, updated_by],
              async (err, result) => {
                if (err) {
                  return res.status(500).json({ message: "Error al crear rol." });
                }
                return res.status(200).json({ message: "Usuario creado exitosamente." });
              }
            );
          }
        );
      }
    );
  });
}

export const registerInternalUserWithoutToken = async (req, res) => {
  const { document, document_type_id, name, middle_name, last_name, email, phone, role_id, password } = req.body;
  if (!document || !document_type_id || !name || !last_name || !email || !phone || !role_id || !password) {
    return res
      .status(400)
      .json({ message: "Todos los campos son obligatorios." });
  }
  const hash = await hashPassword(password);

  validatePersonExistByDocumentEmailPhone(document, email, phone)
    .then((validatePersonExist) => {
      if (validatePersonExist.process === "error") {
        return res.status(400).json({ message: validatePersonExist.message });
      }
    })
    .catch((error) => {
      console.log(error);
      return res.status(500).json({ message: "Error al validar persona." });
    })

  validateUserExist(email)
    .then((validateUserExist) => {
      if (validateUserExist.process === "error") {
        return res.status(400).json({ message: validateUserExist.message });
      }
    })
    .catch((error) => {
      console.log(error);
      return res.status(500).json({ message: "Error al validar usuario." });
    })

  const username = email;
  const isActive = true;
  const created_by = transversalUUID();
  const updated_by = transversalUUID();

  // insert person
  pool.query(
    "INSERT INTO persons (document, document_type_id, name, middle_name, last_name, email, phone, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
    [document, document_type_id, name, middle_name, last_name, email, phone, created_by, updated_by],
    async (err, result) => {
      if (err) {
        return res.status(500).json({ message: "Error al crear persona." });
      }
      const person_id = result.rows[0].id;
      // insert user
      pool.query(
        "INSERT INTO users (person_id, username, password, is_active, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [person_id, username, hash, isActive, created_by, updated_by],
        async (err, result) => {
          if (err) {
            return res.status(500).json({ message: "Error al crear usuario." });
          }
          const user_id = result.rows[0].id;
          // insert user_role
          pool.query(
            "INSERT INTO user_roles (user_id, role_id, created_by, updated_by) VALUES ($1, $2, $3, $4)",
            [user_id, role_id, created_by, updated_by],
            async (err, result) => {
              if (err) {
                return res.status(500).json({ message: "Error al crear rol." });
              }
              return res.status(200).json({ message: "Usuario creado exitosamente." });
            }
          );
        }
      );
    }
  );

} 