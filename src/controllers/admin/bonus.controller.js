import jwt from "jsonwebtoken";
import authConfig from "../../config/auth.config.js";
import pool from "../../config/db.config.js";
import { userWithPermissions, validateUserIsActive } from "../common/common.controller.js";


// Create a new bonus
// AC-BN-001
export const createBonus = async (req, res) => {
 try {
  const token = req.cookies.token;
  const validateUserWithPermissions = await userWithPermissions(token);
  if (validateUserWithPermissions.process !== "success") {
   return res.status(401).json({
    process: validateUserWithPermissions.process,
    message: validateUserWithPermissions.message,
   });
  }

  const userId = validateUserWithPermissions.id;

  const {
   title,
   description,
   bonus_type,
   bonus_amount,
   apply_type,
   max_times_per_user,
   min_sales_required,
   valid_from,
   valid_until
  } = req.body;

  // Validar campos obligatorios
  if (!title || !valid_from || !valid_until) {
   return res.status(400).json({
    process: "error",
    message: "Los campos título, fecha inicio y fecha fin son obligatorios.",
   });
  }

  // Verificar si ya existe un bonus activo
  const activeBonus = await pool.query(
   "SELECT id, title FROM bonuses WHERE is_active = TRUE LIMIT 1"
  );

  if (activeBonus.rows.length > 0) {
   return res.status(400).json({
    process: "error",
    message: `Ya existe un bono activo: "${activeBonus.rows[0].title}". Debe inactivar el bono actual antes de crear uno nuevo.`,
   });
  }

  // Insertar el nuevo bono como activo
  const result = await pool.query(
   `INSERT INTO bonuses 
     (title, description, bonus_type, bonus_amount, apply_type, max_times_per_user, min_sales_required, is_active, valid_from, valid_until, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, $10)
    RETURNING *`,
   [
    title,
    description || 'Descripción del bono pendiente por definir.',
    bonus_type || 'MONEY',
    bonus_amount || 0,
    apply_type || 'EVERY_SALE',
    max_times_per_user || 1,
    min_sales_required || 1,
    valid_from,
    valid_until,
    userId
   ]
  );

  return res.status(200).json({
   process: "success",
   message: "Bono creado exitosamente.",
   data: result.rows[0],
  });

 } catch (error) {
  console.log("ERROR GLOBAL createBonus: ", error);
  return res.status(500).json({
   process: "error",
   message: "Lo sentimos, no se pudo crear el bono, inténtelo más tarde. (AC-BN-001).",
  });
 }
};


// Update an existing bonus
// AC-BN-002
export const updateBonus = async (req, res) => {
 try {
  const token = req.cookies.token;
  const validateUserWithPermissions = await userWithPermissions(token);
  if (validateUserWithPermissions.process !== "success") {
   return res.status(401).json({
    process: validateUserWithPermissions.process,
    message: validateUserWithPermissions.message,
   });
  }

  const userId = validateUserWithPermissions.id;

  // Decodificar el ID del bonus desde el JWT del parámetro
  const { id } = req.params;
  let bonusId;
  try {
   const decoded = jwt.verify(id, authConfig.secret);
   bonusId = decoded.bonusId;
  } catch (err) {
   return res.status(400).json({
    process: "error",
    message: "El identificador del bonus no es válido o ha expirado.",
   });
  }

  const {
   title,
   description,
   bonus_type,
   bonus_amount,
   apply_type,
   max_times_per_user,
   min_sales_required,
   is_active,
   valid_from,
   valid_until
  } = req.body;



  // Si se quiere activar, verificar que no haya otro bonus activo
  if (is_active) {
   const activeBonus = await pool.query(
    "SELECT id, title FROM bonuses WHERE is_active = TRUE AND id != $1 LIMIT 1",
    [bonusId]
   );

   if (activeBonus.rows.length > 0) {
    return res.status(400).json({
     process: "info",
     message: `No se puede activar este bonus. Ya existe un bonus activo: "${activeBonus.rows[0].title}". Debe inactivarlo primero.`,
    });
   }
  }

  const result = await pool.query(
   `UPDATE bonuses SET
     title = COALESCE($1, title),
     description = COALESCE($2, description),
     bonus_type = COALESCE($3, bonus_type),
     bonus_amount = COALESCE($4, bonus_amount),
     apply_type = COALESCE($5, apply_type),
     max_times_per_user = $6,
     min_sales_required = COALESCE($7, min_sales_required),
     is_active = COALESCE($8, is_active),
     valid_from = COALESCE($9, valid_from),
     valid_until = COALESCE($10, valid_until),
     updated_at = NOW(),
     updated_by = $11
    WHERE id = $12
    RETURNING *`,
   [
    title || null,
    description || null,
    bonus_type || null,
    bonus_amount || null,
    apply_type || null,
    max_times_per_user !== undefined ? max_times_per_user : null,
    min_sales_required || null,
    is_active !== undefined ? is_active : null,
    valid_from || null,
    valid_until || null,
    userId,
    bonusId
   ]
  );

  if (result.rows.length === 0) {
   return res.status(404).json({
    process: "error",
    message: "Bonus no encontrado.",
   });
  }

  return res.status(200).json({
   process: "success",
   message: "Bonus actualizado exitosamente.",
   data: result.rows[0],
  });

 } catch (error) {
  console.log("ERROR GLOBAL updateBonus: ", error);
  return res.status(500).json({
   process: "error",
   message: "Lo sentimos, no se pudo actualizar el bonus, inténtelo más tarde. (AC-BN-002).",
  });
 }
};


// Get the currently active bonus
// AC-BN-003
export const getActiveBonus = async (req, res) => {
 try {
  const token = req.cookies.token;
  const validateUser = await validateUserIsActive(token);
  if (validateUser.process !== "success") {
   return res.status(401).json({
    process: validateUser.process,
    message: validateUser.message,
   });
  }

  const result = await pool.query(
   `SELECT 
     b.id,
     b.title,
     b.description,
     --b.bonus_type,
     --b.bonus_amount,
     --b.apply_type,
     --b.max_times_per_user,
     --b.min_sales_required,
     b.is_active,
     CASE b.bonus_type WHEN 'MONEY' THEN 
        '$ ' || REPLACE(
            TO_CHAR(b.bonus_amount, 'FM999,999,999,990'),
            ',', '.'
        )
     END AS bonus_amount_formatted,
     CASE b.bonus_type
      WHEN 'MONEY' THEN 'Dinero'
     END AS bonus_type_formatted,
     CASE b.apply_type
      WHEN 'FIRST_SALE' THEN 'Primera venta'
      WHEN 'EVERY_SALE' THEN 'Cada venta'
      WHEN 'ONCE' THEN 'Una vez'
      WHEN 'AFTER_N_SALES' THEN 'Después de N ventas'
     END AS apply_type_formatted,
     TO_CHAR(b.valid_from, 'DD') || ' de ' ||
     INITCAP(
         CASE EXTRACT(MONTH FROM b.valid_from)
             WHEN 1 THEN 'ene'
             WHEN 2 THEN 'feb'
             WHEN 3 THEN 'mar'
             WHEN 4 THEN 'abr'
             WHEN 5 THEN 'may'
             WHEN 6 THEN 'jun'
             WHEN 7 THEN 'jul'
             WHEN 8 THEN 'ago'
             WHEN 9 THEN 'sep'
             WHEN 10 THEN 'oct'
             WHEN 11 THEN 'nov'
             WHEN 12 THEN 'dic'
         END
     ) || ' de ' ||
     TO_CHAR(b.valid_from, 'YYYY') AS valid_from_formatted,
     TO_CHAR(b.valid_until, 'DD') || ' de ' ||
     INITCAP(
         CASE EXTRACT(MONTH FROM b.valid_until)
             WHEN 1 THEN 'ene'
             WHEN 2 THEN 'feb'
             WHEN 3 THEN 'mar'
             WHEN 4 THEN 'abr'
             WHEN 5 THEN 'may'
             WHEN 6 THEN 'jun'
             WHEN 7 THEN 'jul'
             WHEN 8 THEN 'ago'
             WHEN 9 THEN 'sep'
             WHEN 10 THEN 'oct'
             WHEN 11 THEN 'nov'
             WHEN 12 THEN 'dic'
         END
     ) || ' de ' ||
     TO_CHAR(b.valid_until, 'YYYY') AS valid_until_formatted,
     TO_CHAR(b.created_at, 'DD') || ' de ' ||
     INITCAP(
         CASE EXTRACT(MONTH FROM b.created_at)
             WHEN 1 THEN 'ene'
             WHEN 2 THEN 'feb'
             WHEN 3 THEN 'mar'
             WHEN 4 THEN 'abr'
             WHEN 5 THEN 'may'
             WHEN 6 THEN 'jun'
             WHEN 7 THEN 'jul'
             WHEN 8 THEN 'ago'
             WHEN 9 THEN 'sep'
             WHEN 10 THEN 'oct'
             WHEN 11 THEN 'nov'
             WHEN 12 THEN 'dic'
         END
     ) || ' de ' ||
     TO_CHAR(b.created_at, 'YYYY FMHH12:MI a.m.') AS created_at_formatted
    FROM bonuses b
    WHERE b.is_active = TRUE
    LIMIT 1`
  );

  if (result.rows.length === 0) {
   return res.status(200).json({
    process: "success",
    message: "No hay ningún bono activo actualmente.",
    data: null,
   });
  }

  // Encriptar el ID del bonus para el frontend
  const bonusData = result.rows[0];
  bonusData.id = jwt.sign(
   { bonusId: bonusData.id },
   authConfig.secret,
   { expiresIn: "120m" }
  );

  return res.status(200).json({
   process: "success",
   message: "Bono activo encontrado.",
   data: bonusData,
  });

 } catch (error) {
  console.log("ERROR GLOBAL getActiveBonus: ", error);
  return res.status(500).json({
   process: "error",
   message: "Lo sentimos, no se pudo obtener el bonus activo, inténtelo más tarde. (AC-BN-003).",
  });
 }
};

// AC-BN-004
// GET /api/admin/bonuses/history
export const getBonusHistory = async (req, res) => {
 try {
  const token = req.cookies.token;
  const hasPermissions = await userWithPermissions(token);
  if (hasPermissions.process !== "success") {
   return res.status(401).json({
    process: hasPermissions.process,
    message: hasPermissions.message,
   });
  }

  const result = await pool.query(
   `SELECT 
     b.id,
     b.title,
     b.description,
     b.bonus_type,
     CASE b.bonus_type WHEN 'MONEY' THEN 
        '$ ' || REPLACE(
            TO_CHAR(b.bonus_amount, 'FM999,999,999,990'),
            ',', '.'
        )
     END AS bonus_amount_formatted,
     CASE b.bonus_type
      WHEN 'MONEY' THEN 'Dinero'
     END AS bonus_type_formatted,
     CASE b.apply_type
      WHEN 'FIRST_SALE' THEN 'Primera venta'
      WHEN 'EVERY_SALE' THEN 'Cada venta'
      WHEN 'ONCE' THEN 'Una vez'
      WHEN 'AFTER_N_SALES' THEN 'Después de N ventas'
     END AS apply_type,
     b.max_times_per_user,
     b.min_sales_required,
     CASE 
      WHEN b.is_active = TRUE THEN 'Activo'
      WHEN b.is_active = FALSE THEN 'Inactivo'
     END AS is_active,
     TO_CHAR(b.valid_from, 'DD') || ' de ' ||
     INITCAP(
         CASE EXTRACT(MONTH FROM b.valid_from)
             WHEN 1 THEN 'ene'
             WHEN 2 THEN 'feb'
             WHEN 3 THEN 'mar'
             WHEN 4 THEN 'abr'
             WHEN 5 THEN 'may'
             WHEN 6 THEN 'jun'
             WHEN 7 THEN 'jul'
             WHEN 8 THEN 'ago'
             WHEN 9 THEN 'sep'
             WHEN 10 THEN 'oct'
             WHEN 11 THEN 'nov'
             WHEN 12 THEN 'dic'
         END
     ) || ' de ' ||
     TO_CHAR(b.valid_from, 'YYYY') AS valid_from_formatted,
     TO_CHAR(b.valid_until, 'DD') || ' de ' ||
     INITCAP(
         CASE EXTRACT(MONTH FROM b.valid_until)
             WHEN 1 THEN 'ene'
             WHEN 2 THEN 'feb'
             WHEN 3 THEN 'mar'
             WHEN 4 THEN 'abr'
             WHEN 5 THEN 'may'
             WHEN 6 THEN 'jun'
             WHEN 7 THEN 'jul'
             WHEN 8 THEN 'ago'
             WHEN 9 THEN 'sep'
             WHEN 10 THEN 'oct'
             WHEN 11 THEN 'nov'
             WHEN 12 THEN 'dic'
         END
     ) || ' de ' ||
     TO_CHAR(b.valid_until, 'YYYY') AS valid_until_formatted,
     TO_CHAR(b.created_at, 'DD') || ' de ' ||
     INITCAP(
         CASE EXTRACT(MONTH FROM b.created_at)
             WHEN 1 THEN 'ene'
             WHEN 2 THEN 'feb'
             WHEN 3 THEN 'mar'
             WHEN 4 THEN 'abr'
             WHEN 5 THEN 'may'
             WHEN 6 THEN 'jun'
             WHEN 7 THEN 'jul'
             WHEN 8 THEN 'ago'
             WHEN 9 THEN 'sep'
             WHEN 10 THEN 'oct'
             WHEN 11 THEN 'nov'
             WHEN 12 THEN 'dic'
         END
     ) || ' de ' ||
     TO_CHAR(b.created_at, 'YYYY FMHH12:MI a.m.') AS created_at_formatted
    FROM bonuses b
    ORDER BY b.created_at DESC`
  );

  if (result.rows.length === 0) {
   return res.status(200).json({
    process: "success",
    message: "No hay ningún bono en el historial.",
    data: [],
   });
  }

  for (const bonus of result.rows) {
   bonus.id = jwt.sign(
    { bonusId: bonus.id },
    authConfig.secret,
    { expiresIn: "120m" }
   );
  }

  return res.status(200).json({
   process: "success",
   message: "Historial de bonos obtenido exitosamente.",
   data: result.rows,
  });

 } catch (error) {
  console.log("ERROR GLOBAL getBonusHistory: ", error);
  return res.status(500).json({
   process: "error",
   message: "Lo sentimos, no se pudo obtener el historial de bonos, inténtelo más tarde. (AC-BN-004).",
  });
 }
};
