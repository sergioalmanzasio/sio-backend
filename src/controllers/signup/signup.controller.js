import pool from "../../config/db.config.js";
import { hashPassword } from "../../utils/password.js";
import { sendEmail } from "../../utils/shared.js";
import jwt from "jsonwebtoken";
import authConfig from "../../config/auth.config.js";
import { validatePersonExistByDocumentEmailPhone, validateUserExist, 
  validateCodeAndExpiresAt, getDocumentTypeIdByAcronym } from "../common/common.controller.js";

import {
  generateToken,
  transversalUUID,
  generateVerificationCode,
  getExpirationDate,
} from "../../utils/shared.js";
import dotenv from "dotenv";
dotenv.config();

//*** SignUp ***
//*** Para realizar este proceso, debio primero validarse si ya existe un usuario con el correo enviado y una persona con el número de documento enviado. 
//*** Si no existe, se procede a crear el usuario y la persona.
export const signUp = async (req, res) => {
  const {
    document,
    document_type_acronym,
    name,
    middle_name,
    last_name,
    email,
    phone,
    password,
    roleName // referral, client, assistant
    // isAssistant,
  } = req.body;
  if (
    !document ||
    !document_type_acronym ||
    !name ||
    !last_name ||
    !email ||
    !phone ||
    !password ||
    !roleName 
    // isAssistant === undefined
  ) {
    return res
      .status(400)
      .json({ message: "Todos los campos son obligatorios." });
  }

  const username = email;

  // const userExist = await validateUserExist(username, res);
  // console.log('userExist', userExist);
  // if (userExist.message === "Usuario encontrado.") {
  //   return res.status(400).json({ message: "Usuario ya existe." });
  // }
  // const personExist = await validatePersonExist(document, res);
  // if (personExist.message === "Persona encontrada.") {
  //   return res.status(400).json({ message: "Número de documento ya existe." });
  // }

  // insert person and get id

  const documentType = await getDocumentTypeIdByAcronym(document_type_acronym);
  if( documentType.process === "error" ) {
    // TD-001: Error con obtención de ID de Tipo documento
    return res.status(400).json({ 
      process: "error",
      message: "Se ha presentado un inconveniente y no se pudo realizar el registro (TD-001)" });
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
        return res.status(500).json({ message: "Error al crear persona." });
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
          // Update createdby and updatedby in persons, by user self
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
                return res.status(500).json({ message: "Error al consultar rol." });
              }
              if (result.rows.length === 0) {
                return res.status(401).json({ message: "Rol no encontrado." });
              }
              const role_id = result.rows[0].id;
      
              pool.query(
                "INSERT INTO user_roles (user_id, role_id, created_by, updated_by) VALUES ($1, $2, $3, $4)",
                [user_id, role_id, user_id, user_id]
              );

              if( roleName === 'assistant' || roleName === 'referral' ) {
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
              }else{
                const sendEmailRegisterUserClient = await sendEmail(email, 'SIO - Bienvenido a SIO', '000000', name, '', 'register-user-client');
                if (!sendEmailRegisterUserClient) {
                  return res.status(500).send({
                    process: "error",
                    message: "Error al enviar correo de bienvenida a SIO al cliente.",
                  });
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
      message: "Ya existe una persona con el documento o correo electrónico o teléfono digitado." 
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
  const expiresAt = getExpirationDate();

  // Save code in database
  pool.query(
    "INSERT INTO signup_code (email, code, expires_at) VALUES ($1, $2, $3)",
    [email, code, expiresAt],
    async (err, result) => {
      if (err) {
        return res
          .status(500)
          .json({ 
            process: "error",
            message: "Error al generar código. intentelo de nuevo." });
      }
      // Send email with code to user for registration
      const sendEmailSignUpCode = await sendEmail(email, 'SIO - Código de verificación', code, name, email, 'user-registration');
      // email, subject, code = '000000', personName, username = 'test@correo.com', flow = 'recovery-password'
      if (!sendEmailSignUpCode) {
        return res.status(500).send({
          process: "error",
          message: "Error al enviar correo del código de registro.",
        });
      } 
      return res
        .status(200)
        .json({ 
          process: "success", 
          code,
          message: `Código generado y enviado al correo electrónico ${email}.` });
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
  pool.query(
    "SELECT * FROM signup_code WHERE email = $1 AND code = $2 AND expires_at > NOW()",
    [email, code],
    (err, result) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Error al validar código." });
      }
      if (result.rows.length === 0) {
        return res
          .status(400)
          .json({ message: "Código inválido." });
      }
      // Update is_used to true
      pool.query(
        "UPDATE signup_code SET is_used = $1 WHERE email = $2 AND code = $3 AND expires_at > NOW()",
        [true, email, code],
        (err, result) => {
          if (err) {
            return res
              .status(500)
              .json({ message: "Error al validar código." });
          }
          return res
            .status(200)
            .json({ message: "Código verificado exitosamente." });
        }
      );
    }   
  );
};

// Register internal user
// Entran datos de person(document,document_type_id,name,middle_name,last_name,email,phone,), role_id, password
export const registerInternalUser = async (req, res) => {
  console.log(req.body)
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