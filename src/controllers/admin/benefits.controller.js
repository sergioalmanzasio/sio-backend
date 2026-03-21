import jwt from "jsonwebtoken";
import authConfig from "../../config/auth.config.js";
import pool from "../../config/db.config.js";
import { userWithPermissions } from "../common/common.controller.js";
import { logger } from "../../utils/logger.js";

// Create a new benefit
export const createBenefit = async (req, res) => {
 try {
  const token = req.token;
  const validateUserWithPermissions = await userWithPermissions(token);
  if (validateUserWithPermissions.process !== "success") {
   return res.status(401).json({
    process: validateUserWithPermissions.process,
    message: validateUserWithPermissions.message,
   });
  }

  const { description } = req.body;

  if (!description) {
   return res.status(400).json({
    process: "info",
    message: "El campo descripción es obligatorio.",
   });
  }

  // Validate if another benefit with the same description exists
  const existingBenefit = await pool.query(
   "SELECT id, description FROM benefits WHERE LOWER(description) = LOWER($1) LIMIT 1",
   [description]
  );

  if (existingBenefit.rows.length > 0) {
   return res.status(400).json({
    process: "info",
    message: `Ya existe un beneficio con la descripción "${existingBenefit.rows[0].description}".`,
   });
  }

  const result = await pool.query(
   `INSERT INTO benefits (description, created_by)
       VALUES ($1, $2)
       RETURNING id, description, is_active`,
   [description, validateUserWithPermissions.id]
  );

  return res.status(200).json({
   process: "success",
   message: "Beneficio creado exitosamente.",
   data: result.rows[0],
  });

 } catch (error) {
  logger.error("Benefits.Controller - createBenefit ERROR GLOBAL: ", error);
  return res.status(500).json({
   process: "error",
   message: "Lo sentimos, no se pudo crear el beneficio, inténtelo más tarde.",
  });
 }
};

// Get benefit by ID
export const getBenefitById = async (req, res) => {
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
  let benefitId;
  try {
   const decoded = jwt.verify(id, authConfig.secret);
   benefitId = decoded.benefitId;
  } catch (err) {
   return res.status(400).json({
    process: "error",
    message: "El identificador del beneficio no es válido o ha expirado.",
   });
  }

  const result = await pool.query(
   "SELECT id, description, is_active FROM benefits WHERE id = $1",
   [benefitId]
  );

  if (result.rows.length === 0) {
   return res.status(404).json({
    process: "error",
    message: "Beneficio no encontrado.",
   });
  }

  const benefitData = result.rows[0];
  benefitData.id = jwt.sign(
   { benefitId: benefitData.id },
   authConfig.secret,
   { expiresIn: "120m" }
  );

  return res.status(200).json({
   process: "success",
   message: "Beneficio encontrado.",
   data: benefitData,
  });

 } catch (error) {
  logger.error("Benefits.Controller - getBenefitById ERROR GLOBAL: ", error);
  return res.status(500).json({
   process: "error",
   message: "Lo sentimos, no se pudo obtener el beneficio, inténtelo más tarde.",
  });
 }
};

// Update benefit
export const updateBenefit = async (req, res) => {
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
  let benefitId;
  try {
   const decoded = jwt.verify(id, authConfig.secret);
   benefitId = decoded.benefitId;
  } catch (err) {
   return res.status(400).json({
    process: "error",
    message: "El identificador del beneficio no es válido o ha expirado.",
   });
  }

  const { description, is_active } = req.body;

  if (description) {
   const existingBenefit = await pool.query(
    "SELECT id, description FROM benefits WHERE LOWER(description) = LOWER($1) AND id != $2 LIMIT 1",
    [description, benefitId]
   );

   if (existingBenefit.rows.length > 0) {
    return res.status(400).json({
     process: "info",
     message: `Ya existe otro beneficio con la descripción "${existingBenefit.rows[0].description}".`,
    });
   }
  }

  const result = await pool.query(
   `UPDATE benefits SET
       description = COALESCE($1, description),
       is_active = COALESCE($2, is_active)
       WHERE id = $3
       RETURNING id, description, is_active`,
   [
    description || null,
    is_active !== undefined ? is_active : null,
    benefitId
   ]
  );

  if (result.rows.length === 0) {
   return res.status(404).json({
    process: "error",
    message: "Beneficio no encontrado para actualizar.",
   });
  }

  // Encrypt the returned ID
  const benefitData = result.rows[0];
  benefitData.id = jwt.sign(
   { benefitId: benefitData.id },
   authConfig.secret,
   { expiresIn: "120m" }
  );

  return res.status(200).json({
   process: "success",
   message: "Beneficio actualizado exitosamente.",
   data: benefitData,
  });

 } catch (error) {
  logger.error("Benefits.Controller - updateBenefit ERROR GLOBAL: ", error);
  return res.status(500).json({
   process: "error",
   message: "Lo sentimos, no se pudo actualizar el beneficio, inténtelo más tarde.",
  });
 }
};

// Get all benefits
export const getAllBenefits = async (req, res) => {
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
   "SELECT id, description, is_active FROM benefits ORDER BY description ASC"
  );

  if (result.rows.length === 0) {
   return res.status(404).json({
    process: "error",
    message: "No se encontraron beneficios.",
   });
  }

  // Encrypt the returned IDs
  const benefitsData = result.rows.map((benefit) => {
   benefit.id = jwt.sign(
    { benefitId: benefit.id },
    authConfig.secret,
    { expiresIn: "120m" }
   );
   return benefit;
  });

  return res.status(200).json({
   process: "success",
   message: "Beneficios obtenidos exitosamente.",
   data: benefitsData,
  });

 } catch (error) {
  logger.error("Benefits.Controller - getAllBenefits ERROR GLOBAL: ", error);
  return res.status(500).json({
   process: "error",
   message: "Lo sentimos, no se pudieron obtener los beneficios, inténtelo más tarde.",
  });
 }
};