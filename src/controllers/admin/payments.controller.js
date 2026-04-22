import jwt from "jsonwebtoken";
import authConfig from "../../config/auth.config.js";
import pool from "../../config/db.config.js";
import { userWithPermissions } from "../common/common.controller.js";
import { logger } from "../../utils/logger.js";
import { sendEmailV2 } from "../../utils/shared.js";

// PCO-AC-001
export const getPaymentsRequeriments = async (req, res) => {
  try {
    const token = req.token;
    const validateUserWithPermissions = await userWithPermissions(token);
    if (validateUserWithPermissions.process !== "success") {
      return res.status(401).json({
        process: validateUserWithPermissions.process,
        message: validateUserWithPermissions.message,
      });
    }

    pool.query(
      `SELECT 
        '$' || REPLACE(
                  TO_CHAR(rco.base_amount, 'FM999,999,999,990'),
                  ',', '.'
              ) AS base_amount, 
        CASE rco.commission_type 
          WHEN 'PERCENTAGE' then 'Porcentaje'
          ELSE 'Valor fijo'
          END AS commission_type, 
        CASE 
            WHEN rco.commission_type = 'PERCENTAGE' THEN 
                TO_CHAR(rco.commission_value, 'FM999G999G990') || '%'
                
            WHEN rco.commission_type = 'FIXED' THEN 
                '$' || REPLACE(
                    TO_CHAR(rco.commission_value, 'FM999,999,999,990'),
                    ',', '.'
                )
        END AS commission_value,
        '$' || REPLACE(
                  TO_CHAR(rco.commission_amount, 'FM999,999,999,990'),
                  ',', '.'
              ) AS commission_to_pay,
        rco.commission_amount AS commission_amount,
      prs.name || ' ' || COALESCE(prs.middle_name, '') || ' ' || prs.last_name AS referral_name,
      ban."name" bank_name, uac.account_number,
      TO_CHAR(
        rco.requested_at,
        'TMMon DD "de" YYYY HH12:MI:SS AM'
      ) AS requiered_at,
      rco.id referral_commission_id, 
      split_part(rco.id::text, '-', 5) AS guide_code
      FROM referral_commissions rco
      JOIN users usr ON usr.id = rco.referral_id
      JOIN persons prs ON prs.id = usr.person_id
      JOIN user_accounts uac ON usr.id = uac.user_id 
      JOIN banks ban ON uac.bank_id = ban.id
      WHERE rco.status = 'REQUESTED_PAYMENT' AND uac.is_active = TRUE
      ORDER BY prs.name || ' ' || COALESCE(prs.middle_name, '') || ' ' || prs.last_name`,
      (err, result) => {
        if (err) {
          logger.error("Payments.Controller.getPaymentsRequeriments Error al obtener los pagos requeridos", err, {
            userID: validateUserWithPermissions.id,
            status: "REQUESTED_PAYMENT"
          });
          return res.status(500).json({
            process: "error",
            message:
              "Lo sentimos, no se pudo obtener los pagos requeridos, inténtelo más tarde. (RC-AC-006).",
          });
        }
        for (let i = 0; i < result.rows.length; i++) {
          result.rows[i].commission_amount = Number(result.rows[i].commission_amount);
          result.rows[i].referral_commission_id = jwt.sign({ referralCommissionId: result.rows[i].referral_commission_id }, authConfig.secret, { expiresIn: "50m" });
        }

        const total_amount = result.rows.reduce((acc, row) => acc + row.commission_amount, 0);
        const total_amount_format = new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          minimumFractionDigits: 0,
        }).format(total_amount);

        return res.status(200).json({
          process: "success",
          message: "Pagos requeridos obtenidos exitosamente.",
          count: result.rows.length,
          total_amount: total_amount_format,
          data: result.rows
        });
      }
    );
  } catch (error) {
    logger.error("Payments.Controller.getPaymentsRequeriments Error global", error, {
      status: "REQUESTED_PAYMENT"
    });

    return res.status(500).json({
      process: "error",
      message:
        "Lo sentimos, no se pudo obtener los pagos requeridos, inténtelo más tarde. (RC-AC-006).",
    });
  }

}

// PCO-AC-002
export const updatePaymentStatus = async (req, res) => {
  try {
    const token = req.token;
    const validateUserWithPermissions = await userWithPermissions(token);
    if (validateUserWithPermissions.process !== "success") {
      return res.status(401).json({
        process: validateUserWithPermissions.process,
        message: validateUserWithPermissions.message,
      });
    }

    const { commissionToken } = req.body;
    if (!commissionToken) {
      return res.status(400).json({
        process: "error",
        message: "El token de la comisión es obligatorio.",
      });
    }

    const decodedCommission = jwt.verify(commissionToken, authConfig.secret);
    const referralCommissionId = decodedCommission.referralCommissionId;

    pool.query(
      "UPDATE referral_commissions SET status = 'PAID', paid_at = $2, updated_at = $3 WHERE id = $1",
      [referralCommissionId, new Date(), new Date()],
      async (err, result) => {
        if (err) {
          logger.error("Payments.Controller.updatePaymentStatus Error al actualizar el estado del pago", err);
          return res.status(500).json({
            process: "error",
            message: "Lo sentimos, no se pudo actualizar el estado del pago, inténtelo más tarde. (PCO-AC-002).",
          });
        }

        pool.query(
          "SELECT commission_payment_id FROM referral_commissions where id = $1",
          [referralCommissionId],
          (err, result) => {
            if (err) {
              logger.error("Payments.Controller.updatePaymentStatus Error al obtener el id de la comisión", err, {
                referral_commission_id: referralCommissionId,
                userID: validateUserWithPermissions.id,
                status: "PAID",
                updated_at: new Date(),
                reason: "Pago de comisión por venta terminada (instalada).",
              });
            }

            const commissionPaymentId = result.rows[0].commission_payment_id;

            pool.query(
              "UPDATE commission_payments SET status = 'PAID', updated_at = $2, reason = $3, updated_by = $4 WHERE id = $1",
              [commissionPaymentId, new Date(), 'Pago de comisión por venta terminada (instalada).', validateUserWithPermissions.id],
              (err, result) => {
                if (err) {
                  logger.error("Payments.Controller.updatePaymentStatus Error al actualizar el estado del pago de comisión", err, {
                    commission_payment_id: commissionPaymentId,
                    referral_commission_id: referralCommissionId,
                    userID: validateUserWithPermissions.id,
                    status: "PAID",
                    updated_at: new Date(),
                    reason: "Pago de comisión por venta terminada (instalada).",
                  });
                  return res.status(500).json({
                    process: "error",
                    message: "Lo sentimos, no se pudo actualizar el estado del pago, inténtelo más tarde. (PCO-AC-002).",
                  });
                }
              }
            );
          }
        );

        // TODO: Enviar correo electrónico/mensaje de texto al usuario informando el pago de la comisión
        const getReferralData = await pool.query(`
          SELECT 
            '$' || REPLACE(TO_CHAR(rco.commission_value, 'FM999,999,999,990'),',', '.') AS amount,
            prs.name || ' ' || COALESCE(prs.middle_name, '') || ' ' || prs.last_name AS referral_name,
            usr.username AS referral_email,
            ban.name AS bank_name, 
            usa.account_number AS account_number, 
            split_part(rco.id::text, '-', 5) AS guide_code
            FROM referral_commissions rco
            LEFT JOIN users usr ON usr.id = rco.referral_id
            LEFT JOIN persons prs ON prs.id = usr.person_id
            LEFT JOIN user_accounts usa ON usa.user_id = usr.id
            LEFT JOIN banks ban ON ban.id = usa.bank_id
            WHERE rco.id = $1
            AND usa.is_active = true`,
          [referralCommissionId]
        );

        if (getReferralData.rows.length === 0) {
          logger.error("Payments.Controller.updatePaymentStatus Error al obtener información del referido", {
            referral_commission_id: referralCommissionId,
            status: "PAID",
            updated_at: new Date(),
            reason: "Pago de comisión por venta terminada (instalada).",
            paidReferredName: getReferralData.rows[0].referral_name,
            referral_email: getReferralData.rows[0].referral_email,
            bankName: getReferralData.rows[0].bank_name,
            accountNumber: getReferralData.rows[0].account_number,
            paidGuideCode: getReferralData.rows[0].guide_code,
            paidAmount: getReferralData.rows[0].amount
          });
        }

        sendEmailV2(
          getReferralData.rows[0].referral_email,
          'Notificación de pago de comisión',
          'notification-to-referral-paid-commision',
          {
            paidReferredName: getReferralData.rows[0].referral_name,
            bankName: getReferralData.rows[0].bank_name,
            accountNumber: getReferralData.rows[0].account_number,
            paidGuideCode: getReferralData.rows[0].guide_code,
            paidAmount: getReferralData.rows[0].amount
          }
        )

        return res.status(200).json({
          process: "success",
          message: "Estado del pago actualizado exitosamente.",
        });
      }
    );

  } catch (error) {
    logger.error("Payments.Controller.updatePaymentStatus Error global", error, {
      status: "PAID"
    });

    return res.status(500).json({
      process: "error",
      message:
        "Lo sentimos, no se pudo actualizar el estado del pago, inténtelo más tarde. (PCO-AC-002).",
    });
  }
}

// PCO-AC-003
// Get paid commissions with base commission_payments
export const getPaidCommissions = async (req, res) => {
  try {
    const token = req.token;
    const validateUserWithPermissions = await userWithPermissions(token);
    if (validateUserWithPermissions.process !== "success") {
      return res.status(401).json({
        process: validateUserWithPermissions.process,
        message: validateUserWithPermissions.message,
      });
    }
    pool.query(
      `SELECT 
        TO_CHAR(
          rco.requested_at,
            'Mon FMDD "de" YYYY hh12:mi pm'
        ) AS requested_at,
        TO_CHAR(
          rco.created_at + INTERVAL '30 days',
          'Mon FMDD "de" YYYY'
        ) AS available_payment_date,
        TO_CHAR(
          rco.paid_at,
            'Mon FMDD "de" YYYY hh12:mi pm'
        ) AS paid_at,
        '$ ' || REPLACE(
          TO_CHAR(rco.commission_amount, 'FM999,999,999,990'), ',', '.'
        ) AS commission_amount_formmated,
        rco.commission_amount,
        prs.name || ' ' || COALESCE(prs.middle_name, '') || ' ' || prs.last_name as referral_name,
        uac.account_number, ban."name" bank_name,
        rsr.tracking_code      
      FROM users usr
      JOIN referral_commissions rco ON rco.referral_id = usr.id
      JOIN referral_service_requests rsr ON rsr.id = rco.referral_service_request_id
      JOIN persons prs ON prs.id = usr.person_id
      JOIN commission_payments cop ON rco.commission_payment_id = cop.id
      JOIN user_accounts uac ON usr.id = uac.user_id
      JOIN banks ban ON uac.bank_id = ban.id
      WHERE rco.status = 'PAID'`,
      (err, result) => {
        if (err) {
          logger.error("Payments.Controller.getPaidCommissions Error al obtener los pagos requeridos", err, {
            userID: validateUserWithPermissions.id,
            status: "PAID"
          });
          return res.status(500).json({
            process: "error",
            message: "Lo sentimos, no se pudo obtener los pagos requeridos, inténtelo más tarde. (PCO-AC-003).",
          });
        }

        const total_amount = result.rows.reduce((acc, row) => acc + Number(row.commission_amount), 0);
        const total_amount_format = new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          minimumFractionDigits: 0,
        }).format(total_amount);

        return res.status(200).json({
          process: "success",
          message: "Pagos requeridos obtenidos exitosamente.",
          count: result.rows.length,
          total_amount: total_amount_format,
          data: result.rows,
        });
      }
    );
  } catch (error) {
    logger.error("Payments.Controller.getPaidCommissions Error global", error, {
      status: "PAID"
    });

    return res.status(500).json({
      process: "error",
      message:
        "Lo sentimos, no se pudo obtener los pagos requeridos, inténtelo más tarde. (PCO-AC-003).",
    });
  }
}

// PCO-AC-004
// Get paid bonuses with base bonus_payments
export const getPaidBonuses = async (req, res) => {
  try {
    const token = req.token;
    const validateUserWithPermissions = await userWithPermissions(token);
    if (validateUserWithPermissions.process !== "success") {
      return res.status(401).json({
        process: validateUserWithPermissions.process,
        message: validateUserWithPermissions.message,
      });
    }

    pool.query(
      `SELECT TO_CHAR(
          btr.requested_at,
            'Mon FMDD "de" YYYY hh12:mi pm'
        ) AS requested_at,
        TO_CHAR(
          btr.paid_at,
            'Mon FMDD "de" YYYY hh12:mi pm'
        ) AS paid_at,
        '$ ' || REPLACE(
          TO_CHAR(btr.amount, 'FM999,999,999,990'), ',', '.'
        ) AS bonus_amount_formmated,
        btr.amount AS bonus_amount,
        prs.name || ' ' || COALESCE(prs.middle_name, '') || ' ' || prs.last_name as referral_name,
        uac.account_number, ban."name" bank_name
      FROM bonus_transactions btr
      LEFT JOIN users usr ON usr.id = btr.referral_user_id
      JOIN persons prs ON prs.id = usr.person_id
      JOIN user_accounts uac ON usr.id = uac.user_id
      JOIN banks ban ON uac.bank_id = ban.id
      WHERE btr.status = 'PAID'`,
      (err, result) => {
        if (err) {
          logger.error("Payments.Controller.getPaidBonuses Error al obtener los pagos requeridos", err, {
            userID: validateUserWithPermissions.id,
            status: "PAID"
          });
          return res.status(500).json({
            process: "error",
            message: "Lo sentimos, no se pudo obtener los pagos requeridos, inténtelo más tarde. (PCO-AC-004).",
          });
        }

        const total_amount = result.rows.reduce((acc, row) => acc + Number(row.bonus_amount), 0);
        const total_amount_format = new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          minimumFractionDigits: 0,
        }).format(total_amount);

        return res.status(200).json({
          process: "success",
          message: "Pagos requeridos obtenidos exitosamente.",
          count: result.rows.length,
          total_amount: total_amount_format,
          data: result.rows,
        });
      }
    );
  } catch (error) {
    logger.error("Payments.Controller.getPaidBonuses Error global", error, {
      status: "PAID"
    });

    return res.status(500).json({
      process: "error",
      message:
        "Lo sentimos, no se pudo obtener los pagos requeridos, inténtelo más tarde. (PCO-AC-004).",
    });
  }
}
