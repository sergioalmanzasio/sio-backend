import jwt from "jsonwebtoken";
import authConfig from "../../config/auth.config.js";
import pool from "../../config/db.config.js";
import { transversalUUID } from "../../utils/shared.js";
import { getPersonIdByDocument, getUserIdByEmail, getServiceRequestStateIDByName, getUserIdByToken, validateUserIsActive } from "../common/common.controller.js";

// RC : Referral Controller
// AC : Action Controller
// RC-AC-001
export const createReferredExistCustomer = async (req, res) => {
  const { referral_email, client_document } = req.body;

  if (!referral_email || !client_document) {
    return res.status(400).json({ process: "error", message: "Todos los campos son obligatorios." });
  }

  const personExist = await getPersonIdByDocument(client_document);
  if (personExist.process === "error") {
    return res.status(400).json({ process: "error", message: "Asociación de cliente no pudo ser realizada, inténte más tarde." });
  }

  const userExist = await getUserIdByEmail(referral_email);
  if (userExist.process === "error") {
    return res.status(400).json({ process: "error", message: "Asociación de cliente no pudo ser realizada, inténte más tarde." });
  }


  // Validando que no exista la relación entre el usuario y la persona
  pool.query(
    "SELECT * FROM referred_clients WHERE user_id = $1 AND person_id = $2",
    [userExist.id, personExist.id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ process: "error", message: "Error al crear cliente referido, inténte más tarde." });
      }

      if (result.rows.length > 0) {
        return res.status(400).json({ process: "error", message: "El cliente ya esta referenciado a este usuario." });
      }
      pool.query(
        "INSERT INTO referred_clients (user_id, person_id, code, created_by, updated_by) VALUES ($1, $2, SUBSTRING(gen_random_uuid()::text FROM 1 FOR 6), $3, $4) RETURNING *",
        [userExist.id, personExist.id, userExist.id, userExist.id],
        (err, result) => {
          if (err) {
            // RC-001: Error al crear cliente referido
            return res.status(500).json({ process: "error", message: "Lo sentimos, no se pudo crear el cliente referido (RC-001)." });
          }

          pool.query(
            `INSERT INTO assigned_referrals (referred_client_id, referred_client_code, MKT_user_id, created_by) 
            VALUES (
              $1,
              $2,
              (  SELECT ur.user_id FROM user_roles ur WHERE ur.role_id = $3 ORDER BY RANDOM() LIMIT 1 ),
              $4
            )`,
            [
              result.rows[0].id,
              result.rows[0].code,
              'b1345452-a506-473c-a6ec-eb9ae932e483',
              userExist.id
            ],
            (err, result) => {
              if (err) {
                // AR-001: Error al crear cliente referido
                // return res.status(500).json({ process: "error", message: "Lo sentimos, no se pudo crear el cliente referido (AR-001)." });
                console.log('ERROR AR-001: No se pudo asociar el cliente referido con un Coordinador de servicios (MKT), RC-AC-001: ', err);
              }
              return res.status(200).json({ process: "success", message: "Cliente referido creado exitosamente." });
            }
          );
        }
      );
    }
  );


};

// RC-AC-002
export const getReferredClients = async (req, res) => {
  const { referral_email } = req.body;

  if (!referral_email) {
    return res.status(400).json({ process: "error", message: "Todos los campos son obligatorios." });
  }

  const userExist = await getUserIdByEmail(referral_email);
  if (userExist.process === "error") {
    // US-001: Error al obtener usuario por correo
    return res.status(400).json({ process: "error", message: "Lo sentimos, no se pudo obtener los clientes referidos (US-001)." });
  }


  pool.query(
    `SELECT
        pr.name || ' ' || COALESCE(pr.middle_name, '') || ' ' || pr.last_name AS full_name,
        rc.code,
        TO_CHAR(rc.created_at, 'TMMon DD "de" YYYY') AS created_at_formatted,
        rc.is_active,
        pr.phone,
        pr.email,

        -- Localización (pueden venir NULL)
        COALESCE(prl.department, 'No definido') AS department,
        COALESCE(prl.city, 'No definido') AS city,
        COALESCE(prl.neighborhood, 'No definido') AS neighborhood,
        COALESCE(prl.address, 'Sin dirección') AS address

      FROM referred_clients rc
      INNER JOIN persons pr
          ON rc.person_id = pr.id
      LEFT JOIN person_locations prl
          ON pr.id = prl.person_id
      WHERE rc.user_id = $1`,
    [userExist.id],
    (err, result) => {
      if (err) {
        // RC-001: Error al obtener clientes referidos
        return res.status(500).json({ process: "error", message: "Lo sentimos, no se pudo obtener los clientes referidos (RC-001)." });
      }
      return res.status(200).json({
        process: "success",
        message: "Clientes referidos obtenidos exitosamente.",
        count: result.rows.length,
        data: result.rows
      });
    }
  );
};

// getReferredClientsByEmailToMKT in table assigned_referrals
// Coordinator Services = MKT
// RC-AC-003
export const getReferredClientsByToCoordinatorServices = async (req, res) => {
  const { coordinator_service_email } = req.body;

  if (!coordinator_service_email) {
    return res.status(400).json({ process: "error", message: "Todos los campos son obligatorios." });
  }

  const userExist = await getUserIdByEmail(coordinator_service_email);
  if (userExist.process === "error") {
    // US-001: Error al obtener usuario por correo
    return res.status(400).json({ process: "error", message: "Lo sentimos, no se pudo obtener los clientes referidos (US-001)." });
  }

  pool.query(
    `SELECT
        pr.name || ' ' || COALESCE(pr.middle_name, '') || ' ' || pr.last_name AS client_name,
        pr.phone AS client_phone,
        pr.email AS client_email,

        -- Localización (pueden venir NULL)
        COALESCE(prl.department, 'No definido') AS client_department,
        COALESCE(prl.city, 'No definido') AS client_city,
        COALESCE(prl.neighborhood, 'No definido') AS client_neighborhood,
        COALESCE(prl.address, 'Sin dirección') AS client_address,
        rc.code,
        TO_CHAR(rc.created_at, 'TMMon DD "de" YYYY') AS created_at,
        rc.is_active,
        (
        	SELECT prs.name || ' ' || COALESCE(prs.middle_name, '') || ' ' || prs.last_name
        	FROM users us 
        	INNER JOIN persons prs
        	ON us.person_id = prs.id
        	WHERE us.id = rc.user_id
        ) as referral_name

      FROM assigned_referrals ar
      INNER JOIN referred_clients rc
          ON ar.referred_client_id = rc.id
      INNER JOIN persons pr
          ON rc.person_id = pr.id
      LEFT JOIN person_locations prl
          ON pr.id = prl.person_id
      WHERE ar.MKT_user_id = $1 
      AND NOT EXISTS (
        SELECT 1
        FROM referral_service_requests rsr
        WHERE rsr.assigned_referral_code = rc.code
          AND rsr.is_active = true
      )`,
    [userExist.id],
    (err, result) => {
      if (err) {
        // RC-001: Error al obtener clientes referidos
        return res.status(500).json({ process: "error", message: "Lo sentimos, no se pudo obtener los clientes (RC-001)." });
      }
      return res.status(200).json({
        process: "success",
        message: "Clientes obtenidos exitosamente.",
        count: result.rows.length,
        data: result.rows
      });
    }
  );
};

// Get general information of referral request service and get all comments
// RC-AC-004
export const getGeneralInformationOfReferralRequestService = async (req, res) => {
  const { referral_code } = req.body;

  if (!referral_code) {
    return res.status(400).json({ process: "error", message: "Todos los campos son obligatorios." });
  }

  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({
      process: "session-expired",
      message:
        "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando.",
    });
  }
  jwt.verify(token, authConfig.secret, async (err, decoded) => {
    if (err) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
      });
    }

    pool.query(
      `SELECT rsr.id, rsr.filing_number,  
          srs.description, 
          TO_CHAR(
            rsr.created_at,
            'Mon FMDD "de" YYYY FMHH12:MI a.m.'
          ) AS created_at_formatted,
          rsr.offer_id, of.name as offer_name, of.description as offer_description, of.price as offer_price,
          op."name" as operator_name
          FROM referral_service_requests rsr
          JOIN service_request_states srs ON rsr.service_request_state_id = srs.id
          JOIN offers of ON rsr.offer_id = of.id
          JOIN operators op ON of.operator_id = op.id
          WHERE rsr.assigned_referral_code = $1
          AND rsr.is_active = TRUE`,
      [referral_code],
      (err, result) => {
        if (err) {
          // RS-001: Error al obtener información de solicitud de servicio
          return res.status(500).json({ process: "error", message: "Lo sentimos, no se pudo obtener la información, intentelo mas tarde (RS-001)." });
        }

        if (result.rows.length === 0) {
          return res.status(404).json({
            process: "info",
            message: `El referido con dódigo de referencia ${referral_code} no tiene una solicitud activa en este momento.`
          });
        }

        pool.query(
          `SELECT 
                com.comment as comment, 
                TO_CHAR(
                    com.created_at,
                    'Mon FMDD "de" YYYY FMHH12:MI a.m.'
                ) AS created_at_formatted, 
                CASE
                    WHEN com.is_system = TRUE THEN 'Sistema'
                    ELSE (
                        SELECT
                            prs.name || ' ' || COALESCE(prs.middle_name, '') || ' ' || prs.last_name
                        FROM users usr
                        INNER JOIN persons prs 
                            ON usr.person_id = prs.id
                        WHERE usr.id = com.user_id
                        LIMIT 1
                    )
                END AS registered_by
            FROM comments_referral_service_request com
            WHERE com.referral_service_request_id = $1 ORDER BY com.created_at DESC`,
          [result.rows[0].id],
          (err, resultComments) => {
            if (err) {
              // RS-002: Error al obtener comentarios de solicitud de servicio
              return res.status(500).json({
                process: "error",
                message: "Lo sentimos, no se pudo obtener la información, intentelo mas tarde (RS-002).",
              });
            }

            return res.status(200).json({
              process: "success",
              message: "Información obtenida exitosamente.",
              data: result.rows[0],
              comments: resultComments.rows
            });
          }
        );


      }
    );

  });
};

/*

Tablas
TODO: Pendiente de realizar este proceso de registro
CREATE TABLE commission_payment_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commission_payment_id UUID NOT NULL, -- commission_payments id
    referral_commission_id UUID NOT NULL, -- referral_commissions id
    amount NUMERIC(12,2) NOT NULL
);

*/



// *** NOTA: actaulizar estado de referral_service_requests basado en el assigned_referral_code y is_active = TRUE
// RC-AC-005
// Finalizando la solicitud de servicio al cliente, es decir, ya fue instalada.
// Paso 1-2
export const finishedReferralServiceRequest = async (req, res) => {
  const { referral_code } = req.body;

  if (!referral_code) {
    return res.status(400).json({
      process: "error",
      message: "Referral code is required.",
    });
  }

  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({
      process: "session-expired",
      message:
        "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando.",
    });
  }
  jwt.verify(token, authConfig.secret, async (err, decoded) => {
    if (err) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
      });
    }

    try {
      const service_request_state_id = await getServiceRequestStateIDByName("Finalizado");
      const result = await pool.query(
        `UPDATE referral_service_requests SET service_request_state_id = $2 WHERE assigned_referral_code = $1 AND is_active = true RETURNING *`,
        [referral_code, service_request_state_id.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          process: "info",
          message: "La solicitud de servicio no se pudo finalizar, inténtelo más tarde (RC-AC-005).",
        });
      }

      return res.status(200).json({
        process: "success",
        message: "Solicitud de servicio finalizada exitosamente.",
        data: result.rows[0],
      });
    } catch (err) {
      // RC-AC-005: Error al finalizar la solicitud de servicio
      return res.status(500).json({
        process: "error",
        message: "Lo sentimos, no se pudo finalizar la solicitud de servicio, inténtelo más tarde (RC-AC-005).",
      });
    }
  });
};

// TODO: basado en el referral_code que se enviará, consultar en la tabla offer_commission_config, calcular comisión de acuerdo sea el caso PERCENTAGE o FIXED y agregar a la tabla referral_commissions, colocar con estado AVAILABLE
// RC-AC-006
// Obteniendo la configuración de la comisión, calculándola y agregándola a la tabla referral_commissions con estado AVAILABLE, lo que quiere decir que ya se puede solicitar el pago de la comisión el referido.
// Paso 3-4-5

export const calculateCommission = async (req, res) => {
  try {
    const { referral_code } = req.body;

    if (!referral_code) {
      return res.status(400).json({
        process: "error",
        message: "Se requiere el código de referido.",
      });
    }

    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando.",
      });
    }

    // ✅ Verificación de JWT sin callback
    let decoded;
    try {
      decoded = jwt.verify(token, authConfig.secret);
    } catch (err) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
      });
    }

    // ===============================
    // CONSULTA CONFIGURACIÓN COMISIÓN
    // ===============================

    const result = await pool.query(
      `SELECT occ.commission_type, 
              occ.commission_value, 
              ofr.price, 
              ofr.id as offer_id, 
              rsr.id as referral_service_request_id, 
              rcl.user_id as refered_user_id,
              occ.id as offer_commission_config_id 
       FROM offer_commission_config occ
       JOIN referral_service_requests rsr ON rsr.offer_id = occ.offer_id
       JOIN offers ofr ON rsr.offer_id = ofr.id
       JOIN referred_clients rcl ON rsr.assigned_referral_code = rcl.code
       WHERE rsr.assigned_referral_code = $1 
       AND rsr.is_active = TRUE
       AND occ.is_active = TRUE`,
      [referral_code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        process: "info",
        message:
          "Lo sentimos, no se pudo calcular la comisión, inténtelo más tarde. (RC-AC-006.01).",
      });
    }

    let offer_commission_config_id = result.rows[0].offer_commission_config_id;

    // ===============================
    // CÁLCULO DE COMISIÓN
    // ===============================

    let commission_amount = 0;

    if (result.rows[0].commission_type === "PERCENTAGE") {
      commission_amount =
        parseFloat(result.rows[0].price) *
        parseFloat(result.rows[0].commission_value) /
        100;
    } else {
      commission_amount = parseFloat(result.rows[0].commission_value);
    }

    const systemUUID = transversalUUID();

    // ===============================
    // INSERTAR COMISIÓN
    // ===============================

    const resultInsert = await pool.query(
      `INSERT INTO referral_commissions (
        referral_id,
        referral_service_request_id,
        offer_commission_config_id,
        commission_type,
        commission_value,
        base_amount,
        commission_amount,
        status,
        commission_payment_id,
        created_by
      ) 
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        result.rows[0].refered_user_id,
        result.rows[0].referral_service_request_id,
        offer_commission_config_id,
        result.rows[0].commission_type,
        result.rows[0].commission_value,
        result.rows[0].price,
        commission_amount,
        "AVAILABLE",
        systemUUID, // TODO: Se coloca el UUID del sistema, este dato debe cambiar cuando se inserte el pago
        systemUUID,
      ]
    );

    if (resultInsert.rows.length === 0) {
      return res.status(500).json({
        process: "error",
        message:
          "Lo sentimos, no se pudo calcular la comisión, inténtelo más tarde. (RC-AC-006.02).",
      });
    }

    // ===============================
    // UPDATE referral_service_requests
    // ===============================

    const resultUpdate = await pool.query(
      `UPDATE referral_service_requests 
       SET is_active = FALSE 
       WHERE id = $1
       RETURNING *`,
      [result.rows[0].referral_service_request_id]
    );

    if (resultUpdate.rows.length === 0) {
      return res.status(500).json({
        process: "error",
        message:
          "Lo sentimos, se ha generado un error inesperado. (RC-AC-006.03).",
      });
    }

    // TODO: validar si aplica bono
    // ===============================
    // Validar si aplica bono
    // ===============================
    const bonusResult = await referralAppliesForBonusV2(resultInsert.rows[0].referral_id)

    if (bonusResult.process === 'error') {
      console.log("ERROR GLOBAL referralAppliesForBonus: ", bonusResult);
    }

    return res.status(200).json({
      process: "success",
      message: "Comisión calculada exitosamente.",
    });

  } catch (error) {
    console.log("ERROR GLOBAL calculateCommission: ", error);

    return res.status(500).json({
      process: "error",
      message:
        "Lo sentimos, no se pudo calcular la comisión, inténtelo más tarde. (RC-AC-006).",
    });
  }
};


//TODO: Get comisiones disponibles para el usuario referido
// RC-AC-007
// Obteniendo comisiones disponibles para el usuario referido
export const getCommissionAvailable = async (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({
      process: "session-expired",
      message:
        "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando.",
    });
  }

  jwt.verify(token, authConfig.secret, async (err, decoded) => {
    if (err) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
      });
    }

    try {

      const validateHasReferredClients = await pool.query(
        `SELECT * FROM referred_clients WHERE user_id = $1`,
        [decoded.id]
      );

      if (validateHasReferredClients.rows.length === 0) {
        return res.status(404).json({
          process: "info",
          message: "No tienes comisiones disponibles, no cuentas con clientes referidos.",
          data: {
            total_commission: 0,
            commissions: [],
          },
        });
      }

      const validateHasServiceRequestActive = await pool.query(
        `SELECT * 
          FROM referred_clients rfc 
          LEFT JOIN referral_service_requests rsr ON rsr.assigned_referral_code = rfc.code
          WHERE rfc.user_id = $1`,
        [decoded.id]
      );

      if (validateHasServiceRequestActive.rows.length === 0) {
        return res.status(404).json({
          process: "info",
          message: "No tienes comisiones disponibles, no se han encontrado solicitudes de servicios.",
          data: {
            total_commission: 0,
            commissions: [],
          },
        });
      }

      const result = await pool.query(
        `SELECT rco.commission_amount, 
          '$ ' || REPLACE(
                TO_CHAR(rco.commission_amount, 'FM999,999,999,990'),
                ',', '.'
          ) AS commission_amount_formmated,
          -- rco.created_at, 
          TO_CHAR(
            rco.created_at,
            'Mon FMDD "de" YYYY'
          ) AS created_at_formatted,
          TO_CHAR(
            rco.created_at + INTERVAL '30 days',
            'Mon FMDD "de" YYYY'
          ) AS available_payment_date,
          ofr."name" AS offer_name, ofr.description AS offer_description, 
          opr."name" AS operator_name, 
          prs.name || ' ' || COALESCE(prs.middle_name, '') || ' ' || prs.last_name as client_name,
          rsr.tracking_code
          FROM users usr
          JOIN referral_commissions rco ON rco.referral_id = usr.id
          JOIN referral_service_requests rsr ON rsr.id = rco.referral_service_request_id
          JOIN offers ofr ON ofr.id = rsr.offer_id 
          JOIN operators opr ON opr.id = ofr.operator_id
          JOIN referred_clients rcl ON rcl.code = rsr.assigned_referral_code
          JOIN persons prs ON prs.id = rcl.person_id
          WHERE usr.id = $1 AND status = 'AVAILABLE'`,
        [decoded.id]
      );

      if (result.rows.length === 0) {
        return res.status(200).json({
          process: "info",
          message: "No tienes comisiones disponibles.",
        });
      }

      let totalCommission = 0;
      result.rows.forEach((commission) => {
        totalCommission += parseFloat(commission.commission_amount);
      });

      // Formateando el total de comisiones en pesos colombianos
      const totalCommissionNumber = Number(totalCommission);

      const totalCommissionFormatted = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
      }).format(totalCommissionNumber);

      return res.status(200).json({
        process: "success",
        message: "Comisiones obtenidas exitosamente.",
        data: {
          total_commission: totalCommissionFormatted,
          commissions: result.rows,
        },
      });
    } catch (err) {
      // RC-AC-007: Error al obtener la comisión
      console.log('err', err);
      return res.status(500).json({
        process: "error",
        message: "Lo sentimos, no se pudo obtener las comisiones disponibles, inténtelo más tarde. (RC-AC-007).",
      });
    }
  });
}

// Get commissions/history
export const getCommissionsHistoryV1 = async (req, res) => {
  try {
    const user = await getUserIdByToken(req);
    if (user.process !== "success") {
      return res.status(401).json({
        process: user.process,
        message: user.message,
      });
    }

    pool.query(
      `SELECT rco.commission_amount, 
          '$ ' || REPLACE(
                TO_CHAR(rco.commission_amount, 'FM999,999,999,990'),
                ',', '.'
          ) AS commission_amount_formmated,
          -- rco.created_at, 
          TO_CHAR(
            rco.created_at,
            'Mon FMDD "de" YYYY hh12:mi am'
          ) AS generated_at,
          TO_CHAR(
            rco.created_at + INTERVAL '30 days',
            'Mon FMDD "de" YYYY'
          ) AS available_payment_date,
          prs.name || ' ' || COALESCE(prs.middle_name, '') || ' ' || prs.last_name as client_name,
          rsr.tracking_code, 
          CASE rco.status
		    WHEN 'GENERATED' THEN 'Generada'
		    WHEN 'AVAILABLE' THEN 'Disponible para cobrar'
		    WHEN 'REQUESTED_PAYMENT' THEN 'Pago solicitado'
		    WHEN 'PAID' THEN 'Pagada'
		    WHEN 'REJECTED' THEN 'Rechazada'
		  END AS status 
      FROM users usr
      JOIN referral_commissions rco ON rco.referral_id = usr.id
      JOIN referral_service_requests rsr ON rsr.id = rco.referral_service_request_id
      JOIN referred_clients rcl ON rcl.code = rsr.assigned_referral_code
      JOIN persons prs ON prs.id = rcl.person_id
      WHERE usr.id = $1`,
      [user.id],
      (err, result) => {
        if (err) {
          console.log('err', err);
          return res.status(500).json({
            process: "error",
            message: "Lo sentimos, no se pudo actualizar el estado del pago, inténtelo más tarde. (PCO-AC-002).",
          });
        }

        let totalCommission = 0;
        result.rows.forEach((commission) => {
          totalCommission += parseFloat(commission.commission_amount);
        });
        const totalCommissionNumber = Number(totalCommission);
        const totalCommissionFormatted = new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          minimumFractionDigits: 0,
        }).format(totalCommissionNumber);

        return res.status(200).json({
          process: "success",
          message: "Comisiones obtenidas exitosamente.",
          data: {
            total_commission: totalCommissionFormatted,
            commissions: result.rows,
          },
        });
      }
    );
  } catch (err) {
    console.log('err', err);
    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo actualizar el estado del pago, inténtelo más tarde. (PCO-AC-002).",
    });
  }
}

// Get commissions/history filtered by status name
export const getCommissionsHistory = async (req, res) => {
  try {
    const user = await getUserIdByToken(req);
    if (user.process !== "success") {
      return res.status(401).json({
        process: user.process,
        message: user.message,
      });
    }
    const { status_name } = req.query;

    if (!status_name) {
      return res.status(400).json({
        process: "error",
        message: "El nombre del estado es obligatorio.",
      });
    }

    // Mapeo de nombres en español a valores en BD
    const STATUS_MAP = {
      'Generada': 'GENERATED',
      'Disponible para cobrar': 'AVAILABLE',
      'Pago solicitado': 'REQUESTED_PAYMENT',
      'Pagada': 'PAID',
      'Rechazada': 'REJECTED',
    };

    const isAll = status_name.toLowerCase() === 'todas';

    if (!isAll && !STATUS_MAP[status_name]) {
      return res.status(400).json({
        process: "error",
        message: "El nombre del estado no es válido. Estados válidos: Todas, Generada, Disponible para cobrar, Pago solicitado, Pagada, Rechazada.",
      });
    }

    const baseQuery = `SELECT rco.commission_amount, 
          '$ ' || REPLACE(
                TO_CHAR(rco.commission_amount, 'FM999,999,999,990'),
                ',', '.'
          ) AS commission_amount_formmated,
          TO_CHAR(
            rco.created_at,
            'Mon FMDD "de" YYYY hh12:mi am'
          ) AS generated_at,
          TO_CHAR(
            rco.created_at + INTERVAL '30 days',
            'Mon FMDD "de" YYYY'
          ) AS available_payment_date,
          prs.name || ' ' || COALESCE(prs.middle_name, '') || ' ' || prs.last_name as client_name,
          rsr.tracking_code, 
          CASE rco.status
            WHEN 'GENERATED' THEN 'Generada'
            WHEN 'AVAILABLE' THEN 'Disponible para cobrar'
            WHEN 'REQUESTED_PAYMENT' THEN 'Pago solicitado'
            WHEN 'PAID' THEN 'Pagada'
            WHEN 'REJECTED' THEN 'Rechazada'
          END AS status 
      FROM users usr
      JOIN referral_commissions rco ON rco.referral_id = usr.id
      JOIN referral_service_requests rsr ON rsr.id = rco.referral_service_request_id
      JOIN referred_clients rcl ON rcl.code = rsr.assigned_referral_code
      JOIN persons prs ON prs.id = rcl.person_id
      WHERE usr.id = $1`;

    let query;
    let params;

    if (isAll) {
      query = baseQuery;
      params = [user.id];
    } else {
      query = baseQuery + ` AND rco.status = $2`;
      params = [user.id, STATUS_MAP[status_name]];
    }

    pool.query(query, params, (err, result) => {
      if (err) {
        console.log('err', err);
        return res.status(500).json({
          process: "error",
          message: "Lo sentimos, no se pudo obtener las comisiones, inténtelo más tarde.",
        });
      }

      let totalCommission = 0;
      result.rows.forEach((commission) => {
        totalCommission += parseFloat(commission.commission_amount);
      });
      const totalCommissionNumber = Number(totalCommission);
      const totalCommissionFormatted = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
      }).format(totalCommissionNumber);

      return res.status(200).json({
        process: "success",
        message: "Comisiones obtenidas exitosamente.",
        data: {
          total_commission: totalCommissionFormatted,
          commissions: result.rows,
        },
      });
    });
  } catch (err) {
    console.log('err', err);
    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo obtener las comisiones, inténtelo más tarde.",
    });
  }
}

// RC-AC-008
// Obteniendo total de comisiones pagadas/no pagadas para el usuario referido
export const getTotalCommision = async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando.",
      });
    }

    // ✅ Verificación de JWT sin callback
    let decoded;
    try {
      decoded = jwt.verify(token, authConfig.secret);
    } catch (err) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
      });
    }

    const result = await pool.query(
      `SELECT SUM(rco.commission_amount) AS total_amount
        FROM referral_commissions rco
        WHERE rco.referral_id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0 || result.rows[0].total_amount === null) {
      return res.status(200).json({
        process: "success",
        message: "Total de comisiones obtenido exitosamente.!",
        data: {
          total_amount: 0,
        },
      });
    }

    return res.status(200).json({
      process: "success",
      message: "Total de comisiones obtenido exitosamente.",
      data: {
        total_amount: result.rows[0].total_amount,
      },
    });

  } catch (error) {
    console.log("ERROR GLOBAL getTotalCommision: ", error);

    return res.status(500).json({
      process: "error",
      message:
        "Lo sentimos, no se pudo obtener el total de comisiones, inténtelo más tarde. (RC-AC-008).",
    });
  }
}

// TODO: proceso para solicitar pago de comisiones por parte del usuario referido, parametro de entrada: referral_code, amount, payment_method, status: REQUESTED_PAYMENT,  se crea registro en commission_payments y se relacionan comisiones.
// RC-AC-009
// Referido solicita el pago de sus comisiones, se crea registro en commission_payments con estado REQUESTED_PAYMENT y se relacionan comisiones.
export const requestPaymentCommission = async (req, res) => {
  try {
    const { tracking_code } = req.body;
    if (!tracking_code) {
      return res.status(400).json({
        process: "error",
        message: "Se requiere el código de seguimiento.",
      });
    }
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando.",
      });
    }

    // ✅ Verificación de JWT sin callback
    let decoded;
    try {
      decoded = jwt.verify(token, authConfig.secret);
    } catch (err) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
      });
    }

    const result = await pool.query(
      `SELECT rcl.user_id as refered_user_id, rco.commission_amount as total_amount, rco.id as commission_id
        FROM referral_service_requests rsr 
        JOIN referral_commissions rco ON rsr.id = rco.referral_service_request_id
        JOIN referred_clients rcl ON rsr.assigned_referral_code = rcl.code
        WHERE rsr.tracking_code = $1 AND rco.status = 'AVAILABLE'`,
      [tracking_code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        process: "info",
        message: "Lo sentimos, no se pudo solicitar el pago de la comisión, inténtelo más tarde. (RC-AC-007).",
      });
    }

    const getReferedUserAccount = await pool.query(
      `SELECT uac.bank_id FROM user_accounts uac
        JOIN banks ban ON ban.id = uac.bank_id
        WHERE uac.user_id = $1`,
      [result.rows[0].refered_user_id]
    );

    if (getReferedUserAccount.rows.length === 0) {
      return res.status(404).json({
        process: "info",
        message: "Lo sentimos, no se pudo solicitar el pago de la comisión, inténtelo más tarde. (RC-AC-007).",
      });
    }

    const systemUUID = transversalUUID();
    const resultInsert = await pool.query(
      `INSERT INTO commission_payments (user_id, user_account_id, total_amount, status, created_by, updated_by) 
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [result.rows[0].refered_user_id, getReferedUserAccount.rows[0].bank_id, result.rows[0].total_amount, "REQUESTED_PAYMENT", systemUUID, systemUUID]
    );

    if (resultInsert.rows.length === 0) {
      return res.status(500).json({
        process: "error",
        message: "Lo sentimos, no se pudo solicitar el pago de la comisión, inténtelo más tarde. (RC-AC-007).",
      });
    }

    // TODO: actualizar estado de comisiones a REQUESTED_PAYMENT
    await pool.query(
      `UPDATE referral_commissions SET status = $1, updated_by = $2 , commission_payment_id = $3, requested_at = $4 WHERE id = $5`,
      ["REQUESTED_PAYMENT", decoded.id, resultInsert.rows[0].id, new Date(), result.rows[0].commission_id]
    );

    return res.status(200).json({
      process: "success",
      message: "Su comisión ha sido solicitada.",
    });

  } catch (error) {
    console.log("ERROR GLOBAL requestPaymentCommission: ", error);

    return res.status(500).json({
      process: "error",
      message:
        "Lo sentimos, no se pudo obtener la comisión, inténtelo más tarde. (RC-AC-008).",
    });
  }
};

// RC-AC-010
// Referido consulta los bonos que tiene generado
export const getReferralBonusesGenerated = async (req, res) => {
  try {
    const token = req.cookies.token;
    const validateUser = await validateUserIsActive(token);
    if (validateUser.process !== "success") {
      return res.status(401).json({
        process: validateUser.process,
        message: validateUser.message,
      });
    }

    const referralUserID = validateUser.id;

    const result = await pool.query(
      `SELECT btr.id AS bonus_transaction_id, 
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
      CASE btr.status
        WHEN 'GENERATED' THEN 'Genereada'
        WHEN 'APPROVED' THEN 'Aprobada'
        WHEN 'PAID' THEN 'Pagada'
      END AS bonus_status_translate,
      TO_CHAR(btr.created_at, 'DD') || ' de ' ||
        INITCAP(
          CASE EXTRACT(MONTH FROM btr.created_at)
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
        ) || ' de ' || TO_CHAR(btr.created_at, 'YYYY') AS created_at_formatted
      FROM bonus_transactions btr
      LEFT JOIN users usr ON usr.id = btr.referral_user_id
      LEFT JOIN persons prs ON prs.id = usr.person_id
      LEFT JOIN bonuses bon ON bon.id = btr.bonus_id
      WHERE usr.id = $1
      AND btr.status = 'GENERATED'`,
      [referralUserID]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        process: "info",
        message: "En esto momentos no tiene bonos generados para solicitar pago.",
        data: []
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
    result.rows.forEach((bonus) => {
      totalBonus += parseFloat(bonus.bonus_amount);
    });
    const totalBonusNumber = Number(totalBonus);
    const totalBonusFormatted = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(totalBonusNumber);

    return res.status(200).json({
      process: "success",
      message: "Bonos generados obtenidos correctamente.",
      total_bonus: totalBonusFormatted,
      data: resultTokenized,
    });

  } catch (error) {
    console.log("ERROR GLOBAL getReferralBonusesGenerated: ", error);

    return res.status(500).json({
      process: "error",
      message:
        "Lo sentimos, no se pudo obtener la comisión, inténtelo más tarde. (RC-AC-010).",
    });
  }
}

// RC-AC-011
// Referido solicita pago de bono(s)
export const requestPaymentBonus = async (req, res) => {
  try {
    const token = req.cookies.token;
    const validateUser = await validateUserIsActive(token);
    if (validateUser.process !== "success") {
      return res.status(401).json({
        process: validateUser.process,
        message: validateUser.message,
      });
    }

    const { bonusTransactionTokens } = req.body;
    if (!bonusTransactionTokens) {
      return res.status(400).json({
        process: "error",
        message: "El token de la transacción es obligatorio.",
      });
    }

    const bonusTransactionIds = bonusTransactionTokens.map(token => {
      const decoded = jwt.verify(token, authConfig.secret);
      return decoded.bonusTransactionId;
    });

    console.log(">>> bonusTransactionIds", bonusTransactionIds);

    let count = 0;
    bonusTransactionIds.forEach(async (bonusTransactionId) => {
      const result = await pool.query(
        `UPDATE bonus_transactions SET status = $1, requested_at = $2 WHERE id = $3`,
        ["REQUESTED_PAYMENT", new Date(), bonusTransactionId]
      );
      count++;
    });
    console.log(">>> count", count);
    console.log(">>> bonusTransactionIds.length", bonusTransactionIds.length);

    if (count === bonusTransactionIds.length) {
      return res.status(200).json({
        process: "success",
        message: "Bono(s) solicitado(s) correctamente.",
      });
    }

    return res.status(200).json({
      process: "success",
      message: "Algunos bonos no se lograron solicitar, inténtelo más tarde.",
    });



  } catch (error) {
    console.log("ERROR GLOBAL updateBonusStatus: ", error);

    return res.status(500).json({
      process: "error",
      message:
        "Lo sentimos, no se pudo actualizar el estado del bono, inténtelo más tarde. (RC-AC-011).",
    });
  }
}

// RC-AC-012
// Referido consulta el historial de sus bonos filtrado por estado
export const getBonusesHistory = async (req, res) => {
  try {
    const user = await getUserIdByToken(req);
    if (user.process !== "success") {
      return res.status(401).json({
        process: user.process,
        message: user.message,
      });
    }

    const { status_name } = req.query;

    if (!status_name) {
      return res.status(400).json({
        process: "error",
        message: "El nombre del estado es obligatorio.",
      });
    }

    // Mapeo de nombres en español a valores en BD
    const STATUS_MAP = {
      'Generado': 'GENERATED',
      'Solicitado': 'REQUESTED_PAYMENT',
      'Pagado': 'PAID',
    };

    const isAll = status_name.toLowerCase() === 'todos';

    if (!isAll && !STATUS_MAP[status_name]) {
      return res.status(400).json({
        process: "error",
        message: "El nombre del estado no es válido.", // Estados válidos: Todos, Generado, Solicitado, Pagado.
      });
    }

    const baseQuery = `
      SELECT btr.id AS bonus_transaction_id,
        --CASE bon.apply_type
          --WHEN 'FIRST_SALE' THEN 'Primera venta'
          --WHEN 'EVERY_SALE' THEN 'Cada venta'
          --WHEN 'ONCE' THEN 'Una venta por usuario'
          --WHEN 'AFTER_N_SALES' THEN 'Hito/meta'
        --END AS apply_type,
        btr.amount AS bonus_amount,
        '$' || REPLACE(
          TO_CHAR(btr.amount, 'FM999,999,999,990'), ',', '.'
        ) AS bonus_amount_formatted,
        CASE btr.status
          WHEN 'GENERATED' THEN 'Generado'
          WHEN 'REQUESTED_PAYMENT' THEN 'Solicitado'
          WHEN 'PAID' THEN 'Pagado'
        END AS status,
        TO_CHAR(btr.created_at, 'DD') || ' de ' ||
        INITCAP(
          CASE EXTRACT(MONTH FROM btr.created_at)
            WHEN 1 THEN 'ene' WHEN 2 THEN 'feb' WHEN 3 THEN 'mar'
            WHEN 4 THEN 'abr' WHEN 5 THEN 'may' WHEN 6 THEN 'jun'
            WHEN 7 THEN 'jul' WHEN 8 THEN 'ago' WHEN 9 THEN 'sep'
            WHEN 10 THEN 'oct' WHEN 11 THEN 'nov' WHEN 12 THEN 'dic'
          END
        ) || ' de ' || TO_CHAR(btr.created_at, 'YYYY hh12:mi am') AS generated_at,
        TO_CHAR(btr.requested_at, 'DD') || ' de ' ||
        INITCAP(
          CASE EXTRACT(MONTH FROM btr.requested_at)
            WHEN 1 THEN 'ene' WHEN 2 THEN 'feb' WHEN 3 THEN 'mar'
            WHEN 4 THEN 'abr' WHEN 5 THEN 'may' WHEN 6 THEN 'jun'
            WHEN 7 THEN 'jul' WHEN 8 THEN 'ago' WHEN 9 THEN 'sep'
            WHEN 10 THEN 'oct' WHEN 11 THEN 'nov' WHEN 12 THEN 'dic'
          END
        ) || ' de ' || TO_CHAR(btr.requested_at, 'YYYY hh12:mi am') AS requested_at,
        TO_CHAR(btr.paid_at, 'DD') || ' de ' ||
        INITCAP(
          CASE EXTRACT(MONTH FROM btr.paid_at)
            WHEN 1 THEN 'ene' WHEN 2 THEN 'feb' WHEN 3 THEN 'mar'
            WHEN 4 THEN 'abr' WHEN 5 THEN 'may' WHEN 6 THEN 'jun'
            WHEN 7 THEN 'jul' WHEN 8 THEN 'ago' WHEN 9 THEN 'sep'
            WHEN 10 THEN 'oct' WHEN 11 THEN 'nov' WHEN 12 THEN 'dic'
          END
        ) || ' de ' || TO_CHAR(btr.paid_at, 'YYYY hh12:mi am') AS paid_at
      FROM bonus_transactions btr
      LEFT JOIN users usr ON usr.id = btr.referral_user_id
      LEFT JOIN bonuses bon ON bon.id = btr.bonus_id
      WHERE usr.id = $1
    `;

    let query;
    let params;

    if (isAll) {
      query = baseQuery + ` ORDER BY btr.created_at DESC`;
      params = [user.id];
    } else {
      query = baseQuery + ` AND btr.status = $2 ORDER BY btr.created_at DESC`;
      params = [user.id, STATUS_MAP[status_name]];
    }

    pool.query(query, params, (err, result) => {
      if (err) {
        console.log('err', err);
        return res.status(500).json({
          process: "error",
          message: "Lo sentimos, no se pudo obtener el historial de bonos, inténtelo más tarde.",
        });
      }

      let totalBonus = 0;
      result.rows.forEach((bonus) => {
        totalBonus += parseFloat(bonus.bonus_amount);
      });
      const totalBonusFormatted = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
      }).format(Number(totalBonus));

      return res.status(200).json({
        process: "success",
        message: "Historial de bonos obtenido exitosamente.",
        data: {
          total_bonus: totalBonusFormatted,
          bonuses: result.rows,
        },
      });
    });

  } catch (err) {
    console.log('err', err);
    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo obtener el historial de bonos, inténtelo más tarde. (RC-AC-012).",
    });
  }
}

// RC-AC-HP-001
export const referralAppliesForBonusV2 = async (referralUserID) => {
  try {

    // 1️⃣ Obtener bono activo
    const bonusResult = await pool.query(`
      SELECT *
      FROM bonuses
      WHERE is_active = TRUE
      AND CURRENT_DATE BETWEEN valid_from AND valid_until
      LIMIT 1
    `);

    if (bonusResult.rows.length === 0) {
      return { process: "error", data: "No hay bono activo" };
    }

    const bonus = bonusResult.rows[0];

    // 2️⃣ Contar ventas
    const salesResult = await pool.query(
      `SELECT COUNT(*) 
       FROM referral_commissions 
       WHERE referral_id = $1 
       AND status IN ('AVAILABLE','PAID')`,
      [referralUserID]
    );

    const salesCount = parseInt(salesResult.rows[0].count);

    // 3️⃣ Validar si ya recibió bono
    const bonusTxResult = await pool.query(
      `SELECT COUNT(*) 
       FROM bonus_transactions 
       WHERE referral_user_id = $1 
       AND bonus_id = $2`,
      [referralUserID, bonus.id]
    );

    const alreadyReceived = parseInt(bonusTxResult.rows[0].count) > 0;

    // console.log("RULE:", bonus.apply_type);
    // console.log("SALES:", salesCount);
    // console.log("BONUS RECEIVED:", alreadyReceived);

    let applies = false;

    // 4️⃣ Evaluar reglas
    switch (bonus.apply_type) {

      case "FIRST_SALE":
        applies = salesCount === 1 && !alreadyReceived;
        break;

      case "EVERY_SALE":
        applies = salesCount > 0;
        break;

      case "ONCE":
        applies = !alreadyReceived;
        break;

      case "AFTER_N_SALES":
        applies =
          salesCount >= bonus.min_sales_required &&
          !alreadyReceived;
        break;

      default:
        return {
          process: "error",
          data: "Tipo de bono no soportado"
        };
    }

    if (!applies) {
      return {
        process: "error",
        data: "El usuario no cumple las condiciones del bono"
      };
    }

    // 5️⃣ Obtener última comisión
    const commissionResult = await pool.query(
      `SELECT id
       FROM referral_commissions
       WHERE referral_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [referralUserID]
    );

    const commissionID = commissionResult.rows[0].id;

    // 6️⃣ Insertar bono
    return await insertBonusToReferalUser(
      referralUserID,
      bonus.id,
      commissionID,
      bonus.bonus_amount,
      bonus.apply_type
    );

  } catch (error) {
    console.log("ERROR referralAppliesForBonus:", error);

    return {
      process: "error",
      data: "Error evaluando bono."
    };
  }
};

// RC-AC-HELPER-002
const insertBonusToReferalUser = async (referralUserID, bonusID, commissionID, amount, ruleName) => {
  try {
    const insertBonusToReferalUser = await pool.query(
      `INSERT INTO bonus_transactions (referral_user_id, bonus_id, referral_commission_id, amount)
      VALUES(
        $1, 
        $2, 
        $3, 
        $4) RETURNING *`,
      [referralUserID, bonusID, commissionID, amount]
    )

    if (insertBonusToReferalUser.rows.length === 0) {
      console.log(`Regla ${ruleName} - No fue posible agregar bono al referido \n
        referralUserID: ${referralUserID}\n
        bonus_id: ${bonusID}\n
        commission_id: ${commissionID}\n
        amount: ${amount}\n
        date: ${new Date()}\n
      `);
      return {
        "process": "error",
        "data": `Regla ${ruleName} - No fue posible agregar bono al referido. (RC-AC-HELPER-002).`
      }
    }

    return {
      "process": "success",
      "data": "Bono agregado correctamente."
    }
  } catch (error) {
    console.log("ERROR GLOBAL insertBonusToReferalUser: ", error);

    return {
      "process": "error",
      "data": "Lo sentimos, no se pudo agregar el bono, inténtelo más tarde. (RC-AC-HELPER-002)."
    }
  }
}





