import jwt from "jsonwebtoken";
import config from "../config/auth.config.js";
import pool from "../config/db.config.js";
import authConfig from "../config/auth.config.js";
import crypto from "crypto";
import { hashPassword, comparePassword } from "../utils/password.js";
import { validateUserExist, validatePersonExist } from "../controllers/common/common.controller.js";
import {
  generateToken,
  transversalUUID,
  generateVerificationCode,
  getExpirationDate,
} from "../utils/shared.js";
import dotenv from "dotenv";
dotenv.config();

//*** SignUp ***
//*** Para realizar este proceso, debio primero validarse si ya existe un usuario con el correo enviado y una persona con el número de documento enviado. 
//*** Si no existe, se procede a crear el usuario y la persona.
export const signUp = async (req, res) => {
  const {
    document,
    document_type_id,
    name,
    middle_name,
    last_name,
    email,
    address,
    phone,
    username,
    password,
    isSeller,
  } = req.body;
  if (
    !document ||
    !document_type_id ||
    !name ||
    !last_name ||
    !email ||
    !address ||
    !phone ||
    !username ||
    !password ||
    !isSeller
  ) {
    return res
      .status(400)
      .json({ message: "Todos los campos son obligatorios." });
  }

  const validateUserExist = await validateUserExist(username, res);
  if (validateUserExist.message === "Usuario encontrado.") {
    return res.status(400).json({ message: "Usuario ya existe." });
  }
  const validatePersonExist = await validatePersonExist(document, res);
  if (validatePersonExist.message === "Persona encontrada.") {
    return res.status(400).json({ message: "Número de documento ya existe." });
  }

  // insert person and get id
  pool.query(
    "INSERT INTO persons (document, document_type_id, name, middle_name, last_name, email, address, phone, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id",
    [
      document,
      document_type_id,
      name,
      middle_name,
      last_name,
      email,
      address,
      phone,
      transversalUUID(),
      transversalUUID(),
    ],
    (err, result) => {
      if (err) {
        return res.status(500).json({ message: "Error al crear persona." });
      }
      const person_id = result.rows[0].id;
      let isActive = isSeller ? false : true;
      // Create user
      const hash = hashPassword(password);
      pool.query(
        "INSERT INTO users (person_id, username, password, is_active, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6)",
        [
          person_id,
          username,
          hash,
          isActive,
          transversalUUID(),
          transversalUUID(),
        ],
        (err, result) => {
          if (err) {
            return res.status(500).json({ message: "Error al crear usuario." });
          }

          // Update createdby and updatedby in persons, by user self
          pool.query(
            "UPDATE persons SET created_by = $1, updated_by = $2 WHERE id = $3",
            [result.rows[0].id, result.rows[0].id, person_id]
          );

          const token = generateToken(username);
          res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production", // En prod SOLO con https
            sameSite: "strict",
            maxAge: 60 * 60 * 1000, // 1 hora
          });
          res.json({
            process: "success",
            message: isSeller
              ? "Usuario creado exitosamente, entrará en un proceso de aprobación y le notificaremos cuando se active."
              : "Inicio de sesión exitoso.",
          });
        }
      );
    }
  );
};

// SignUp | Generate code
export const signUpGenerateCode = async (req, res) => {
  const { email, document } = req.body;
  if (!email || !document) {
    return res
      .status(400)
      .json({ message: "Todos los campos son obligatorios." });
  }

  const code = generateVerificationCode();
  const expiresAt = getExpirationDate();

  // Save code in database
  pool.query(
    "INSERT INTO signup_code (email, code, expires_at) VALUES ($1, $2, $3)",
    [email, code, expiresAt],
    (err, result) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Error al generar código. intentelo de nuevo." });
      }
      return res
        .status(200)
        .json({ 
          process: "success", 
          code,
          message: "Código generado exitosamente." });
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