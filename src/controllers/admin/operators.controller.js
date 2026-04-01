import jwt from "jsonwebtoken";
import authConfig from "../../config/auth.config.js";
import pool from "../../config/db.config.js";
import { userWithPermissions } from "../common/common.controller.js";
import { logger } from "../../utils/logger.js";

export const createOperator = async (req, res) => {
  try {
    const token = req.token;
    const validateUserWithPermissions = await userWithPermissions(token);
    if (validateUserWithPermissions.process !== "success") {
      return res.status(401).json({
        process: validateUserWithPermissions.process,
        message: validateUserWithPermissions.message,
      });
    }

    const { name, description, color } = req.body;

    if (!name) {
      return res.status(400).json({
        process: "info",
        message: "El campo nombre es obligatorio.",
      });
    }

    const existingOperator = await pool.query(
      "SELECT id, name FROM operators WHERE LOWER(name) = LOWER($1) LIMIT 1",
      [name]
    );

    if (existingOperator.rows.length > 0) {
      return res.status(400).json({
        process: "info",
        message: `Ya existe un operador con el nombre "${existingOperator.rows[0].name}".`,
      });
    }

    const result = await pool.query(
      `INSERT INTO operators (name, description, image_name, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description`,
      [name, description || null, 'default-icon.png', validateUserWithPermissions.id]
    );

    const getIdColor = await pool.query(
      `SELECT id FROM available_colors WHERE name_class = $1`,
      [color]
    );

    if (getIdColor.rows.length === 0) {
      logger.error("Operators.Controller - createOperator - error al consultar ID del color para asignar al operdador: ", {
        operatorId: result.rows[0].id,
        color,
        userId: validateUserWithPermissions.id
      });
    }

    const addColorToOperator = await pool.query(
      `INSERT INTO operator_color (operator_id, available_color_id, created_by) VALUES ($1, $2, $3) RETURNING id`,
      [result.rows[0].id, getIdColor.rows[0].id, validateUserWithPermissions.id]
    );

    if (addColorToOperator.rows.length === 0) {
      logger.error("Operators.Controller - createOperator - error al asignar color al operdador: ", {
        operatorId: result.rows[0].id,
        color,
        colorID: getIdColor.rows[0].id,
        userId: validateUserWithPermissions.id
      });
    }

    const operatorData = result.rows[0];
    operatorData.id = jwt.sign(
      { operatorId: operatorData.id },
      authConfig.secret,
      { expiresIn: "120m" }
    );

    return res.status(200).json({
      process: "success",
      message: "Operador creado exitosamente.",
      data: operatorData,
    });

  } catch (error) {
    logger.error("Operators.Controller - createOperator ERROR GLOBAL: ", error);
    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo crear el operador, inténtelo más tarde.",
    });
  }
};

export const getOperatorById = async (req, res) => {
  try {
    const token = req.token;
    const validateUserWithPermissions = await userWithPermissions(token);
    if (validateUserWithPermissions.process !== "success") {
      return res.status(401).json({
        process: validateUserWithPermissions.process,
        message: validateUserWithPermissions.message,
      });
    }

    const { id } = req.params;
    let operatorId;
    try {
      const decoded = jwt.verify(id, authConfig.secret);
      operatorId = decoded.operatorId;
    } catch (err) {
      return res.status(400).json({
        process: "error",
        message: "El identificador del operador no es válido o ha expirado.",
      });
    }

    const result = await pool.query(
      "SELECT id, name, description, is_active FROM operators WHERE id = $1",
      [operatorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        process: "error",
        message: "Operador no encontrado.",
      });
    }

    const operatorData = result.rows[0];
    operatorData.id = jwt.sign(
      { operatorId: operatorData.id },
      authConfig.secret,
      { expiresIn: "120m" }
    );

    return res.status(200).json({
      process: "success",
      message: "Operadores encontrado.",
      data: operatorData,
    });

  } catch (error) {
    logger.error("Operators.Controller - getOperatorById ERROR GLOBAL: ", error);
    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo obtener el operador, inténtelo más tarde.",
    });
  }
};

export const updateOperator = async (req, res) => {
  try {
    const token = req.token;
    const validateUserWithPermissions = await userWithPermissions(token);
    if (validateUserWithPermissions.process !== "success") {
      return res.status(401).json({
        process: validateUserWithPermissions.process,
        message: validateUserWithPermissions.message,
      });
    }

    const { token: id } = req.params;
    let operatorId;
    try {
      const decoded = jwt.verify(id, authConfig.secret);
      operatorId = decoded.operatorId;
    } catch (err) {
      return res.status(400).json({
        process: "error",
        message: "El identificador del operador no es válido o ha expirado.",
      });
    }

    const { name, description, is_active, color } = req.body;

    if (name) {
      const existingOperator = await pool.query(
        "SELECT id, name FROM operators WHERE LOWER(name) = LOWER($1) AND id != $2 LIMIT 1",
        [name, operatorId]
      );

      if (existingOperator.rows.length > 0) {
        return res.status(400).json({
          process: "error",
          message: `Ya existe otro operador con el nombre "${existingOperator.rows[0].name}".`,
        });
      }
    }

    const result = await pool.query(
      `UPDATE operators SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       is_active = COALESCE($3, is_active)
       WHERE id = $4
       RETURNING id, name, description, is_active`,
      [
        name || null,
        description || null,
        is_active !== undefined ? is_active : null,
        operatorId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        process: "error",
        message: "Lo sentimos, no fue posible actualizar el operador. Inténtelo más tarde.",
      });
    }

    const getIdColor = await pool.query(
      `SELECT id FROM available_colors WHERE name_class = $1`,
      [color]
    );

    if (getIdColor.rows.length === 0) {
      logger.error("Operators.Controller - updateOperator - error al consultar ID del color para actualizar al operdador: ", {
        operatorId: result.rows[0].id,
        color,
        userId: validateUserWithPermissions.id
      });
    }

    const addColorToOperator = await pool.query(
      `UPDATE operator_color SET operator_id = $1, available_color_id = $2, updated_by = $3 WHERE operator_id = $1 RETURNING id`,
      [result.rows[0].id, getIdColor.rows[0].id, validateUserWithPermissions.id]
    );

    if (addColorToOperator.rows.length === 0) {
      logger.error("Operators.Controller - updateOperator - error al actualizar color al operdador: ", {
        operatorId: result.rows[0].id,
        color,
        colorID: getIdColor.rows[0].id,
        userId: validateUserWithPermissions.id
      });
    }

    const operatorData = result.rows[0];
    operatorData.id = jwt.sign(
      { operatorId: operatorData.id },
      authConfig.secret,
      { expiresIn: "120m" }
    );

    return res.status(200).json({
      process: "success",
      message: "Operador actualizado exitosamente.",
      data: operatorData,
    });

  } catch (error) {
    logger.error("OperatorsController.updateOperator - Error global:", {
      error: error,
    });
    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo actualizar el operador, inténtelo más tarde.",
    });
  }
};

// Get all operators
export const getAllOperators = async (req, res) => {
  try {
    const token = req.token;
    const validateUserWithPermissions = await userWithPermissions(token);
    if (validateUserWithPermissions.process !== "success") {
      return res.status(401).json({
        process: validateUserWithPermissions.process,
        message: validateUserWithPermissions.message,
      });
    }

    const result = await pool.query(
      // "SELECT id, name, description, is_active, image_name AS logo FROM operators ORDER BY name ASC"
      `SELECT opr.id, opr.name, opr.description, opr.is_active, opr.image_name AS logo, acl.name_class AS color 
        FROM operators opr 
        LEFT JOIN operator_color ocl ON ocl.operator_id = opr.id
        LEFT JOIN available_colors acl ON ocl.available_color_id = acl.id
        WHERE ocl.is_active = TRUE
        ORDER BY opr.name ASC`
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        process: "error",
        message: "No se encontraron operadores.",
      });
    }

    // Encrypt the returned IDs
    const operatorsData = result.rows.map((operator) => {
      operator.id = jwt.sign(
        { operatorId: operator.id },
        authConfig.secret,
        { expiresIn: "120m" }
      );
      return operator;
    });

    return res.status(200).json({
      process: "success",
      message: "Operadores obtenidos exitosamente.",
      data: operatorsData,
    });

  } catch (error) {
    logger.error("Operators.Controller - getAllOperators ERROR GLOBAL: ", error);
    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudieron obtener los operadores, inténtelo más tarde.",
    });
  }
};