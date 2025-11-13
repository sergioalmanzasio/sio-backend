import jwt from "jsonwebtoken";
import pool from "../../config/db.config.js";
import authConfig from "../../config/auth.config.js";
import { comparePassword } from "../../utils/password.js";
import { generateToken } from "../../utils/shared.js";
import dotenv from "dotenv";
dotenv.config();

// SignIn
export const signIn = (req, res) => {
  console.log('req.body', req.body);
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Usuario y contraseña son obligatorios." });
  }
  pool.query(
    "SELECT * FROM users WHERE username = $1",
    [username],
    (err, result) => {
      if (err) {
        return res.status(500).json({ message: "Error al consultar usuario." });
      }
      if (result.rows.length === 0) {
        return res
          .status(401)
          .json({ message: "Usuario o contraseña invalidos." });
      }
      const user = result.rows[0];
      if (!user.is_active) {
        return res.status(401).json({ message: "Usuario no activo." });
      }
      const isPasswordValid = comparePassword(password, user.password);
      if (!isPasswordValid) {
        return res
          .status(401)
          .json({ message: "Usuario o contraseña invalidos." });
      }
      const token = generateToken(user.id);
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // En prod SOLO con https
        sameSite: "strict",
        maxAge: 60 * 60 * 1000, // 1 hora
      });

      res.json({ 
        process: "success",
        message: "Inicio de sesión exitoso." 
      });
    }
  );
};

// Get data for the session
export const getSessionData = (req, res) => {
  const token = req.cookies.token;
  if (!token) { // No encontró token
    return res.status(401).json({ message: "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando." });
  }
  jwt.verify(token, authConfig.secret, (err, decoded) => {
    if (err) { // Token inválido
      return res.status(401).json({ message: "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad." });
    }
    // Consultar person by user_id
    pool.query(
      "SELECT * FROM persons WHERE id = (SELECT person_id FROM users WHERE id = $1)",
      [decoded.id],
      (err, result) => {
        if (err) {
          return res.status(500).json({ message: "Error al consultar datos de la persona." });
        }
        if (result.rows.length === 0) {
          return res.status(401).json({ message: "Persona no encontrada." });
        }
        const person = result.rows[0];

        // Consultar roles by user_id
        pool.query(
          "SELECT * FROM roles WHERE id = (SELECT role_id FROM user_roles WHERE user_id = $1)",
          [decoded.id],
          (err, result) => {
            if (err) {
              return res.status(500).json({ message: "Error al consultar datos del rol asociado al usuario." });
            }
            if (result.rows.length === 0) {
              return res.status(401).json({ message: "Rol asociado al usuario no encontrado." });
            }
            const roles = result.rows;

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

