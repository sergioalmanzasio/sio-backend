import pool from "../../config/db.config.js";
import { getDocumentTypeIdByAcronym, getUserIdByEmail } from "../common/common.controller.js";

export const createPersonByReferral = async (req, res) => {
  const { document, document_type_acronym, name, middle_name, last_name, email, phone,
    department, city, neighborhood, address, type_of_housing,
    observations, referral_email } = req.body;

  if (!document || !document_type_acronym || !name || !last_name || !email || !phone || !department || !city || !neighborhood || !address || !type_of_housing || !observations || !referral_email) {
    return res.status(400).json({ process: "error", message: "Todos los campos son obligatorios." });
  }

  const documentType = await getDocumentTypeIdByAcronym(document_type_acronym);
  if (documentType.process === "error") {
    // TD-001: Error con obtención de ID de Tipo documento
    return res.status(400).json({
      process: "error",
      message: "Lo sentimos, no fue posible la creación del cliente, inténte más tarde. (TD-001)"
    });
  }

  const userExist = await getUserIdByEmail(referral_email);
  if (userExist.process === "error") {
    // US-001: Error con obtención de ID de Usuario
    return res.status(400).json({ process: "error", message: "Lo sentimos, no fue posible la creación del cliente, inténte más tarde. (US-001)" });
  }

  pool.query(
    "INSERT INTO persons (document, document_type_id, name, middle_name, last_name, email, phone, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
    [
      document,
      documentType.id,
      name,
      middle_name,
      last_name,
      email,
      phone,
      userExist.id,
    ],
    (err, result) => {
      if (err) {
        return res.status(500).json({ process: "error", message: "Lo sentimos, no fue posible la creación del cliente, inténte más tarde." });
      }
      pool.query(
        "INSERT INTO person_locations (person_id, country, department, city, neighborhood, address, type_of_housing, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          result.rows[0].id,
          '00|Colombia',
          department,
          city,
          neighborhood,
          address,
          type_of_housing,
          userExist.id,
        ],
        (err, result) => {
          if (err) {
            return res.status(500).json({ process: "error", message: "Lo sentimos, no fue posible la creación del cliente, inténte más tarde." });
          }
          return res.status(200).json({
            process: "success",
            message: "Cliente creado exitosamente."
          });
        }
      );
    }
  );
}

export const validatePersonExistByDocument = async (req, res) => {
  const { document } = req.body;

  if (!document) {
    return res.status(400).json({ process: "document-required", message: "Documento es obligatorio." });
  }

  pool.query(
    "SELECT * FROM persons WHERE document = $1",
    [document],
    (err, result) => {
      if (err) {
        return res.status(500).json({ process: "error", message: "Error al consultar persona." });
      }
      if (result.rows.length === 0) {
        return res.status(401).json({ process: "person-not-found", message: "Persona no encontrada." });
      }
      return res.status(200).json({ process: "person-found", message: "Persona encontrada." });
    }
  );
};
