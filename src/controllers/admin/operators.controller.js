import jwt from "jsonwebtoken";
import authConfig from "../../config/auth.config.js";
import pool from "../../config/db.config.js";
import { userWithPermissions } from "../common/common.controller.js";
import { logger } from "../../utils/logger.js";

// Create a new operator
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

    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        process: "info",
        message: "El campo nombre es obligatorio.",
      });
    }

    // Validate if another operator with the same name exists
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

    return res.status(200).json({
      process: "success",
      message: "Operador creado exitosamente.",
      data: result.rows[0],
    });

  } catch (error) {
    logger.error("Operators.Controller - createOperator ERROR GLOBAL: ", error);
    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo crear el operador, inténtelo más tarde.",
    });
  }
};

// Get operator by ID
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

// Update operator
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
    console.log('...validateUserWithPermissions: ', validateUserWithPermissions);

    const { token: id } = req.params;
    console.log('...id: ', id);
    let operatorId;
    try {
      const decoded = jwt.verify(id, authConfig.secret);
      console.log('...decoded: ', decoded);
      operatorId = decoded.operatorId;
    } catch (err) {
      return res.status(400).json({
        process: "error",
        message: "El identificador del operador no es válido o ha expirado.",
      });
    }
    console.log('...operatorId: ', operatorId);

    const { name, description, is_active } = req.body;

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
        message: "Operador no encontrado para actualizar.",
      });
    }

    // Encrypt the returned ID
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
    console.log("ERROR GLOBAL updateOperator: ", error);
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
      "SELECT id, name, description, is_active FROM operators ORDER BY name ASC"
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