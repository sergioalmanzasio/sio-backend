import jwt from "jsonwebtoken";
import authConfig from "../../config/auth.config.js";
import pool from "../../config/db.config.js";
import { userWithPermissions, validateUserIsActive } from "../common/common.controller.js";
import { logger } from "../../utils/logger.js";

export const createBonus = async (req, res) => {
  try {
    const token = req.token;
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
      valid_until,
      is_active
    } = req.body;

    if (!title || !valid_from || !valid_until) {
      return res.status(400).json({
        process: "error",
        message: "Los campos título, fecha inicio y fecha fin son obligatorios.",
      });
    }

    if (is_active) {
      const activeBonus = await pool.query(
        "SELECT id, title FROM bonuses WHERE is_active = TRUE LIMIT 1"
      );

      if (activeBonus.rows.length > 0) {
        return res.status(400).json({
          process: "info",
          message: `Ya existe un bono activo: "${activeBonus.rows[0].title}". Debe inactivar el bono actual antes de crear uno nuevo.`,
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO bonuses 
     (title, description, bonus_type, bonus_amount, apply_type, max_times_per_user, min_sales_required, is_active, valid_from, valid_until, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
      [
        title,
        description || 'Descripción del bono pendiente por definir.',
        bonus_type || 'MONEY',
        bonus_amount || 0,
        apply_type || 'EVERY_SALE',
        max_times_per_user || 1,
        min_sales_required || 1,
        is_active || false,
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
    logger.error("BonusController.createBonus - Error global:", {
      error: error,
    });
    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo crear el bono, inténtelo más tarde. (AC-BN-001).",
    });
  }
};

export const updateBonus = async (req, res) => {
  try {
    const token = req.token;
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
          message: `El bono "${activeBonus.rows[0].title} se encuentra activo". Debe inactivarlo primero.`,
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
        apply_type === 'EVERY_SALE' ? null : max_times_per_user !== undefined ? max_times_per_user : null,
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
    logger.error("BonusController.updateBonus - Error global:", {
      error: error,
    });
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
    const token = req.token;
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
    logger.error("BonusController.getActiveBonus - Error global:", {
      error: error,
    });
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
    const token = req.token;
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
                    WHEN 'ONCE' THEN 'Una venta por usuario'
                    WHEN 'AFTER_N_SALES' THEN 'Hito/meta'
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
    logger.error("BonusController.getBonusHistory - Error global:", {
      error: error,
    });
    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo obtener el historial de bonos, inténtelo más tarde. (AC-BN-004).",
    });
  }
};

// AC-BN-005
// Get bonuses requested payment
export const getBonusesRequestedPayment = async (req, res) => {
  try {
    const token = req.token;
    const hasPermissions = await userWithPermissions(token);
    if (hasPermissions.process !== "success") {
      return res.status(401).json({
        process: hasPermissions.process,
        message: hasPermissions.message,
      });
    }

    const result = await pool.query(
      `SELECT btr.id AS bonus_transaction_id, 
                prs.name || ' ' || COALESCE(prs.middle_name, '') || ' ' || prs.last_name as referral_name,
                CASE bon.apply_type
                    WHEN 'FIRST_SALE' THEN 'Primera venta'
                    WHEN 'EVERY_SALE' THEN 'Cada venta'
                    WHEN 'ONCE' THEN 'Una venta por usuario'
                    WHEN 'AFTER_N_SALES' THEN 'Hito/meta'
                END AS apply_type, 
                btr.amount as bonus_amount, 
                '$' || REPLACE(
                    TO_CHAR(btr.amount, 'FM999,999,999,990'),
                        ',', '.'
                ) as bonus_amount_formatted, 
                btr.status AS bonus_status,
                CASE btr.status
                    WHEN 'GENERATED' THEN 'Genereada'
                    WHEN 'REQUESTED_PAYMENT' THEN 'Solicitada'
                    WHEN 'PAID' THEN 'Pagada'
                END AS bonus_status_translate,
                TO_CHAR(btr.requested_at, 'DD') || ' de ' ||
                  INITCAP(
                      CASE EXTRACT(MONTH FROM btr.requested_at)
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
                  TO_CHAR(btr.requested_at, 'YYYY') || 
                  ' ' || 
                  TO_CHAR(btr.requested_at, 'HH12:MI AM') AS requested_at_formatted
                FROM bonus_transactions btr
                LEFT JOIN users usr ON usr.id = btr.referral_user_id
                LEFT JOIN persons prs ON prs.id = usr.person_id
                LEFT JOIN bonuses bon ON bon.id = btr.bonus_id
                WHERE btr.status = 'REQUESTED_PAYMENT' 
                ORDER BY referral_name`
    );

    if (result.rows.length === 0) {
      return res.status(200).json({
        process: "success",
        message: "No hay ningún bono en el historial.",
        data: [],
      });
    }

    const resultTokenized = result.rows.map(row => {
      return {
        ...row,
        bonus_transaction_id: jwt.sign({ bonusTransactionId: row.bonus_transaction_id }, authConfig.secret, {
          expiresIn: "1h"
        })
      }
    })

    let totalBonus = 0;
    result.rows.forEach((bonus) => totalBonus += parseFloat(bonus.bonus_amount));
    const totalBonusNumber = Number(totalBonus);
    const totalBonusFormatted = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(totalBonusNumber);

    return res.status(200).json({
      process: "success",
      message: "Historial de bonos obtenido exitosamente.",
      totalBonus: totalBonusFormatted,
      data: resultTokenized,
    });

  } catch (error) {
    logger.error("BonusController.getBonusesRequestedPayment - Error global:", {
      error: error,
    });
    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo obtener los bonos solicitados, inténtelo más tarde. (AC-BN-005).",
    });
  }
};


// AC-BN-006
// Mark bonuses as PAID
export const paidBonuses = async (req, res) => {
  try {
    const token = req.token;
    const hasPermissions = await userWithPermissions(token);
    if (hasPermissions.process !== "success") {
      return res.status(401).json({
        process: hasPermissions.process,
        message: hasPermissions.message,
      });
    }

    const { bonusTransactionTokens } = req.body;
    if (!bonusTransactionTokens || !Array.isArray(bonusTransactionTokens) || bonusTransactionTokens.length === 0) {
      return res.status(400).json({
        process: "error",
        message: "Debe proporcionar al menos un token de transacción de bono.",
      });
    }

    // Decodificar todos los tokens y obtener los IDs reales
    const bonusTransactionIds = [];
    for (const txToken of bonusTransactionTokens) {
      try {
        const decoded = jwt.verify(txToken, authConfig.secret);
        bonusTransactionIds.push(decoded.bonusTransactionId);
      } catch (err) {
        return res.status(400).json({
          process: "error",
          message: "Uno o más tokens de transacción no son válidos o han expirado.",
        });
      }
    }

    // Actualizar el estado de cada transacción a PAID
    let updatedCount = 0;
    for (const bonusTransactionId of bonusTransactionIds) {
      const result = await pool.query(
        `UPDATE bonus_transactions 
                 SET status = 'PAID', paid_at = CURRENT_TIMESTAMP 
                 WHERE id = $1 AND status = 'REQUESTED_PAYMENT'
                 RETURNING id`,
        [bonusTransactionId]
      );
      if (result.rows.length > 0) {
        updatedCount++;
      }
    }

    if (updatedCount === 0) {
      return res.status(400).json({
        process: "error",
        message: "No se actualizó ningún bono. Verifique que los bonos tengan estado 'REQUESTED_PAYMENT'.",
      });
    }

    if (updatedCount === bonusTransactionIds.length) {
      return res.status(200).json({
        process: "success",
        message: `${updatedCount} bono(s) fueron marcados como pagados.`,
        payment_marked: updatedCount,
        total_payment_marked: bonusTransactionIds.length,
      });
    } else {
      return res.status(200).json({
        process: "success",
        message: `${updatedCount} de ${bonusTransactionIds.length} bono(s) fueron marcados como pagados.`,
        payment_marked: updatedCount,
        total_payment_marked: bonusTransactionIds.length,
      });
    }

  } catch (error) {
    logger.error("BonusController.paidBonuses - Error global:", {
      error: error,
    });
    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo marcar los bonos como pagados, inténtelo más tarde. (AC-BN-006).",
    });
  }
};

