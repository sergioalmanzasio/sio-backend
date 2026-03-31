import jwt from "jsonwebtoken";
import authConfig from "../../config/auth.config.js";
import pool from "../../config/db.config.js";
import { userWithPermissions } from "../common/common.controller.js";
import { logger } from "../../utils/logger.js";

export const createCategory = async (req, res) => {
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

  if (!name || !description) {
   return res.status(400).json({
    process: "info",
    message: "Todos los campos son obligatorios.",
   });
  }

  // Validate if another category with the same name exists
  const existingCategory = await pool.query(
   "SELECT id, name FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1",
   [name]
  );

  if (existingCategory.rows.length > 0) {
   return res.status(400).json({
    process: "info",
    message: `Ya existe una categoría con el nombre "${existingCategory.rows[0].name}".`,
   });
  }

  const result = await pool.query(
   `INSERT INTO categories (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, name, description`,
   [name, description, validateUserWithPermissions.id]
  );

  return res.status(200).json({
   process: "success",
   message: "Categoría creada exitosamente.",
  });

 } catch (error) {
  logger.error("Category.Controller - createCategory ERROR GLOBAL: ", error);
  return res.status(500).json({
   process: "error",
   message: "Lo sentimos, no se pudo crear la categoría, inténtelo más tarde.",
  });
 }
};


export const getCategoryByToken = async (req, res) => {
 try {
  const token = req.token;
  const validateUserWithPermissions = await userWithPermissions(token);
  if (validateUserWithPermissions.process !== "success") {
   return res.status(401).json({
    process: validateUserWithPermissions.process,
    message: validateUserWithPermissions.message,
   });
  }

  const { token: categoryToken } = req.params;
  let categoryId;
  try {
   const decoded = jwt.verify(categoryToken, authConfig.secret);
   categoryId = decoded.categoryId;
  } catch (err) {
   logger.error("Category.Controller - getCategoryByToken error al decodificar el token: ", err);
   return res.status(400).json({
    process: "error",
    message: "Lo sentimos, no fue posible obtener la categoría, inténtelo más tarde.",
   });
  }

  const result = await pool.query(
   "SELECT id, name, description, is_active FROM categories WHERE id = $1",
   [categoryId]
  );

  if (result.rows.length === 0) {
   return res.status(404).json({
    process: "error",
    message: "Lo sentimos, no se encontro la categoría.",
   });
  }

  const categoryData = result.rows[0];
  categoryData.id = jwt.sign(
   { categoryId: categoryData.id },
   authConfig.secret,
   { expiresIn: "120m" }
  );

  return res.status(200).json({
   process: "success",
   message: "Categoría encontrada.",
   data: categoryData,
  });

 } catch (error) {
  logger.error("Category.Controller - getCategoryByToken ERROR GLOBAL: ", error);
  return res.status(500).json({
   process: "error",
   message: "Lo sentimos, no se pudo obtener la categoría, inténtelo más tarde.",
  });
 }
};


export const updateCategory = async (req, res) => {
 try {
  const token = req.token;
  const validateUserWithPermissions = await userWithPermissions(token);
  if (validateUserWithPermissions.process !== "success") {
   return res.status(401).json({
    process: validateUserWithPermissions.process,
    message: validateUserWithPermissions.message,
   });
  }

  const { categoryToken } = req.params;
  let categoryId;
  try {
   const decoded = jwt.verify(categoryToken, authConfig.secret);
   categoryId = decoded.categoryId;
  } catch (err) {
   logger.error("Category.Controller - updateCategory error al decodificar el token: ", err);
   return res.status(400).json({
    process: "error",
    message: "Lo sentimos, no fue posible obtener la categoría, inténtelo más tarde.",
   });
  }

  const { name, description, is_active } = req.body;

  if (name) {
   const existingCategory = await pool.query(
    "SELECT id, name, is_active FROM categories WHERE LOWER(name) = LOWER($1) AND id != $2 LIMIT 1",
    [name, categoryId]
   );

   if (existingCategory.rows.length > 0) {
    return res.status(400).json({
     process: "error",
     message: `Ya existe otra categoría con el nombre "${existingCategory.rows[0].name}".`,
    });
   }
  }

  const getInitialCategoryStatus = await pool.query(
   "SELECT * FROM categories WHERE id = $1 LIMIT 1",
   [categoryId]
  );

  const result = await pool.query(
   `UPDATE categories SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       is_active = COALESCE($3, is_active),
       updated_by = $4,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, name, description, is_active`,
   [
    name || null,
    description || null,
    is_active !== undefined ? is_active : null,
    validateUserWithPermissions.id,
    categoryId,
   ]
  );

  if (getInitialCategoryStatus.rows.length > 0 && getInitialCategoryStatus.rows[0].is_active !== is_active) {
   const offersResult = await pool.query(
    `SELECT o.*, op.name as operator_name, 
      CASE 
          WHEN cat."name" IS NULL OR cat."name" = '' THEN 'No categorizada'
          ELSE cat."name"
        END AS category_name
      FROM offers o 
      LEFT JOIN operators op ON o.operator_id = op.id
      LEFT JOIN categories_offers cto ON o.id = cto.offer_id
      LEFT JOIN categories cat ON cto.category_id = cat.id
      WHERE cat.id = $1
      ORDER BY o.created_at DESC`,
    [categoryId]
   );

   if (offersResult.rows.length > 0) {
    for (const offer of offersResult.rows) {
     await pool.query(
      `UPDATE offers SET
        is_active = COALESCE($1, is_active),
        updated_by = $2,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id, name, description, is_active`,
      [
       is_active !== undefined ? is_active : null,
       validateUserWithPermissions.id,
       offer.id,
      ]
     );
    }
   }
  }

  if (result.rows.length === 0) {
   return res.status(404).json({
    process: "error",
    message: "Lo sentimos, no se encontro la categoría.",
   });
  }

  const categoryData = result.rows[0];
  categoryData.id = jwt.sign(
   { categoryId: categoryData.id },
   authConfig.secret,
   { expiresIn: "120m" }
  );

  return res.status(200).json({
   process: "success",
   message: "Categoría actualizada exitosamente.",
   data: categoryData,
  });

 } catch (error) {
  logger.error("Category.Controller - updateCategory ERROR GLOBAL: ", error);
  return res.status(500).json({
   process: "error",
   message: "Lo sentimos, no se pudo actualizar la categoría, inténtelo más tarde.",
  });
 }
};

export const getAllCategories = async (req, res) => {
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
   "SELECT id, name, description, is_active FROM categories ORDER BY name ASC"
  );

  if (result.rows.length === 0) {
   return res.status(404).json({
    process: "error",
    message: "No se encontraron categorías.",
   });
  }

  const categoriesData = result.rows.map((category) => {
   category.id = jwt.sign(
    { categoryId: category.id },
    authConfig.secret,
    { expiresIn: "120m" }
   );
   return category;
  });

  return res.status(200).json({
   process: "success",
   message: "Categorías obtenidas exitosamente.",
   data: categoriesData,
  });

 } catch (error) {
  logger.error("Category.Controller - getAllCategories ERROR GLOBAL: ", error);
  return res.status(500).json({
   process: "error",
   message: "Lo sentimos, no se pudieron obtener las categorías, inténtelo más tarde.",
  });
 }
};
