import pool from "../../config/db.config.js";

// Validate if user exist by username
export const validateUserExist = async (username) => {
  return new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username],
      (err, result) => {
        if (err) {
          return reject({ process: "error", message: "Error en la base de datos." });
        }

        if (result.rows.length > 0) {
          return resolve({
            process: "error",
            message: "Ya existe usuario con el correo electrónico "+username+".",
          });
        }

        return resolve({ process: "success" });
      }
    );
  });
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

// Validate person by document, email or phone
export const validatePersonExistByDocumentEmailPhone = (document, email, phone) => {
  return new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM persons WHERE document = $1 OR email = $2 OR phone = $3",
      [document, email, phone],
      (err, result) => {
        if (err) {
          return reject({ process: "error", message: "Error en la base de datos." });
        }

        if (result.rows.length > 0) {
          return resolve({
            process: "error",
            message: "El documento, correo o teléfono ya están registrados.",
          });
        }

        return resolve({ process: "success" });
      }
    );
  });
};

// Get role id by role name cliente
export const getRoleIdByClientName = async (res) => {
  await pool.query(
    "SELECT * FROM roles WHERE name = $1",
    ["client"],
    (err, result) => {
      if (err) {
        console.log('err', err);
        return res.status(500).json({ message: "Error al consultar rol." });
      }
      if (result.rows.length === 0) {
        return res.status(401).json({ message: "Rol no encontrado." });
      }
      console.log('result.rows[0].id', result.rows[0].id);
      return res.status(200).json({ 
        message: "Rol encontrado.", 
        id: result.rows[0].id 
      });
    }
  );
}

// Get role id by role name asesor
export const getRoleIdByAssistantName = async (res) => {
  await pool.query(
    "SELECT * FROM roles WHERE name = $1",
    ["assistant"],
    (err, result) => {
      if (err) {
        return res.status(500).json({ message: "Error al consultar rol." });
      }
      if (result.rows.length === 0) {
        return res.status(401).json({ message: "Rol no encontrado." });
      }
      return res.status(200).json({ 
        message: "Rol encontrado.", 
        id: result.rows[0].id 
      });
    }
  );  
}



