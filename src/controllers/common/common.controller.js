import pool from "../config/db.config.js";

// Validate if user exist by username
export const validateUserExist = async (username, res) => {
  if (!username) {
    return res.status(400).json({ message: "Usuario es obligatorio." });
  }
  await pool.query(
    "SELECT * FROM users WHERE username = $1",
    [username],
    (err, result) => {  
      if (err) {
        return res.status(500).json({ message: "Error al consultar usuario." });
      }
      if (result.rows.length === 0) {
        return res.status(401).json({ message: "Usuario no encontrado." });
      }
      return res.status(200).json({ message: "Usuario encontrado." });
    }
  );
};

// Validate if person exist by document
export const validatePersonExist = async (document, res) => {
  if (!document) {
    return res.status(400).json({ message: "Documento es obligatorio." });
  }
  await pool.query(
    "SELECT * FROM persons WHERE document = $1",
    [document],
    (err, result) => {
      if (err) {
        return res.status(500).json({ message: "Error al consultar persona." });
      }
      if (result.rows.length === 0) {
        return res.status(401).json({ message: "Persona no encontrada." });
      }
      return res.status(200).json({ message: "Persona encontrada." });
    }
  );
};

