import pool from "../../config/db.config.js";
import { transversalUUID } from "../../utils/shared.js";
import { logger } from "../../utils/logger.js";


export const insertDocumentType = (req, res) => {
  const { name, description, acronym } = req.body;
  if (!name || !description || !acronym) {
    return res
      .status(400)
      .json({ message: "Todos los campos son obligatorios." });
  }
  pool.query(
    "SELECT * FROM document_types WHERE name = $1 OR acronym = $2",
    [name, acronym],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          process: "error",
          message: "Error al consultar tipos de documentos."
        });
      }
      if (result.rows.length > 0) {
        return res.status(401).json({ message: "Tipo de documento ya existe." });
      }
      pool.query(
        "INSERT INTO document_types (name, description, acronym, created_by, updated_by) VALUES ($1, $2, $3, $4, $5)",
        [name, description, acronym, transversalUUID(), transversalUUID()],
        (err, result) => {
          if (err) {
            logger.error("DocumentTypeController.insertDocumentType - Error global:", {
              error: err,
            });
            return res.status(500).json({ message: "Error al insertar tipo de documento." });
          }
          return res.status(200).json({ message: "Tipo de documento insertado exitosamente." });
        }
      );
    }
  );
}

// Get all document types
export const getAllDocumentTypes = (req, res) => {
  pool.query(
    "SELECT id, name, acronym FROM document_types",
    (err, result) => {
      if (err) {
        return res.status(500).json({ message: "Error al consultar tipos de documentos." });
      }
      return res.status(200).json({ message: "Tipos de documentos encontrados.", data: result.rows });
    }
  );
}

// Get document type by id
export const getDocumentTypeById = (req, res) => {
  const { id } = req.params;
  pool.query(
    "SELECT * FROM document_types WHERE id = $1",
    [id],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          process: "error",
          message: "Error al consultar tipo de documento."
        });
      }
      return res.status(200).json({ message: "Tipo de documento encontrado.", data: result.rows });
    }
  );
}

// Update document type
export const updateDocumentType = (req, res) => {
  const { id } = req.params;
  const { name, description, acronym } = req.body;
  if (!name || !description || !acronym) {
    return res
      .status(400)
      .json({ message: "Todos los campos son obligatorios." });
  }
  pool.query(
    "UPDATE document_types SET name = $2, description = $3, acronym = $4, updated_at = $5 WHERE id = $1",
    [id, name, description, acronym, new Date()],
    (err, result) => {
      if (err) {
        return res.status(500).json({ message: "Error al actualizar tipo de documento." });
      }
      return res.status(200).json({ message: "Tipo de documento actualizado exitosamente." });
    }
  );
}

// Inactivate/activate document type
export const inactivateActivateDocumentType = (req, res) => {
  const { id } = req.params;
  pool.query(
    "UPDATE document_types SET is_active = NOT is_active, updated_at = $2 WHERE id = $1 RETURNING is_active",
    [id, new Date()],
    (err, result) => {
      let isActive = result.rows[0].is_active;
      if (err) {
        return res.status(500).json({ message: "Error al inactivar/activar tipo de documento." });
      }
      return res.status(200).json({ message: `Tipo de documento ${isActive ? 'ACTIVADO' : 'INACTIVADO'} exitosamente.` });
    }
  );
}
