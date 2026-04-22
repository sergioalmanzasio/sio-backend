import jwt from "jsonwebtoken";
import pool from "../../config/db.config.js";
import authConfig from "../../config/auth.config.js";
import { sendEmail, sendEmailV2, transversalUUID, getUserSystemEnv } from "../../utils/shared.js";
import { getUserIdByEmail, getServiceRequestStateIDByName } from "../common/common.controller.js";
import { logger } from "../../utils/logger.js";
import { sendNotification } from "../../services/notification.service.js";
import { NotificationChannels } from "../../modules/notifications/notification.types.js";


// Add service_request
export const addServiceRequest = (req, res) => {
  const { email, offer_id, is_assisted, assistant_code } = req.body;
  if (!email || !offer_id || is_assisted === "undefined" || !assistant_code) {
    // is_assisted = false how to validate?
    return res.status(400).json({
      process: "error",
      message: "Todos los campos son obligatorios.",
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
  jwt.verify(token, authConfig.secret, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
      });
    }
    // Get client_user_id by email
    pool.query(
      `SELECT us.id as user_id, pr."name" as person_name 
						FROM users us
						JOIN persons pr ON us.username = pr.email
						WHERE us.username = $1`,
      [email],
      (err, result) => {
        if (err) {
          return res.status(500).json({
            process: "error",
            message: "Error al agregar solicitud de servicio.",
          });
        }
        if (result.rows.length === 0) {
          return res.status(404).json({
            process: "error",
            message: "El cliente no se encuentra registrado.",
          });
        }
        const client_user_id = result.rows[0].user_id;
        const person_name = result.rows[0].person_name;
        let serviceRequestCode = "";
        pool.query(
          `INSERT INTO service_requests (client_user_id, offer_id, is_assisted, assistant_code, created_by, updated_by)
							VALUES ($1, $2, $3, $4, $5, $6)
							RETURNING *`,
          [
            client_user_id,
            offer_id,
            is_assisted,
            assistant_code,
            client_user_id,
            client_user_id,
          ],
          (err, result) => {
            if (err) {
              return res
                .status(500)
                .json({ message: "Error al agregar solicitud de servicio." });
            }

            pool.query(
              `INSERT INTO service_requests_code (client_user_id, service_request_id, code, created_by, updated_by)
									VALUES ($1, $2, 'OS-' || SUBSTRING(gen_random_uuid()::text FROM 1 FOR 6), $3, $4)
									RETURNING *`,
              [
                client_user_id,
                result.rows[0].id,
                client_user_id,
                client_user_id,
              ],
              async (err, resultRequestCode) => {
                if (err) {
                  return res
                    .status(500)
                    .json({
                      message:
                        "Error al agregar código de solicitud de servicio.",
                    });
                }
                serviceRequestCode = resultRequestCode.rows[0].code.split("-")[1];
                const sendEmailRegisterUserAssistant = await sendEmail(
                  email,
                  "Confirmación de Orden de Servicio",
                  serviceRequestCode,
                  person_name,
                  email,
                  "notification-client-service-request"
                );
                if (!sendEmailRegisterUserAssistant) {
                  return res.status(500).send({
                    process: "error",
                    message:
                      "Error al enviar correo de bienvenida a SIO al asesor.",
                  });
                }

                // Assigned service request to random service coordinator
                // service_request_id = result.rows[0].id
                // service_coordinator_id = random
                // created_by = TRANSVERSALUUID
                // updated_by = TRANSVERSALUUID
                pool.query(
                  `
                  INSERT INTO assigned_service_requests (
                      service_request_id,
                      mkt_user_id,
                      created_by,
                      updated_by
                  )
                  SELECT
                      $1 AS service_request_id,
                      (
                          SELECT ur.user_id
                          FROM user_roles ur
                          WHERE ur.role_id = $3
                          ORDER BY RANDOM()
                          LIMIT 1
                      ) AS mkt_user_id,
                      $2 AS created_by,
                      $2 AS updated_by
                  RETURNING *;
                `,
                  [
                    result.rows[0].id, // $1 → service_request_id
                    transversalUUID(),    // $2 → created_by, updated_by
                    'b1345452-a506-473c-a6ec-eb9ae932e483'          // $3 → role_id para buscar el usuario aleatorio
                  ],
                  (err, resultAssignedServiceRequest) => {
                    if (err) {
                      console.error(err);
                      // return res.status(500).json({
                      //   message: "Error al asignar solicitud de servicio.",
                      // });
                    }

                    // Si todo está bien
                  }
                );


                res.json({
                  process: "success",
                  message: "Solicitud de servicio agregada exitosamente.",
                  data: result.rows[0],
                  code: serviceRequestCode,
                });
              }
            );
          }
        );
      }
    );
  });
};

// Validate if client_user_id has a pending request
export const validatePendingRequest = (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({
      message: "El campo email es obligatorio.",
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
  jwt.verify(token, authConfig.secret, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
      });
    }
    // Get client_user_id by email
    pool.query(
      `SELECT * FROM users WHERE username = $1 LIMIT 1`,
      [email],
      (err, result) => {
        if (err) {
          return res.status(500).json({
            hasPendingRequest: false,
            message: "Error al validar solicitud de servicio.",
          });
        }
        if (result.rows.length === 0) {
          return res.status(404).json({
            hasPendingRequest: false,
            message: "El cliente no se encuentra registrado.",
          });
        }
        const client_user_id = result.rows[0].id;
        // Validate if client_user_id has a pending request
        pool.query(
          `SELECT * FROM service_requests WHERE client_user_id = $1 AND status = 'PENDING'`,
          [client_user_id],
          (err, result) => {
            if (err) {
              return res.status(500).json({
                hasPendingRequest: false,
                message: "Error al validar solicitud de servicio.",
              });
            }
            if (result.rows.length > 0) {
              return res.status(400).json({
                hasPendingRequest: true,
                message:
                  "Ya tiene una solicitud en proceso. No puede adquirir otra oferta hasta que se complete la actual.",
              });
            }
            res.json({
              process: "success",
              hasPendingRequest: false,
              message: "Cliente no tiene una solicitud de servicio pendiente.",
            });
          }
        );
      }
    );
  });
};

// Get request by email
export const getServiceRequestByClient = (req, res) => {
  const { email } = req.body;
  if (
    !email ||
    email === "" ||
    email === null ||
    email === undefined
  ) {
    return res.status(400).json({
      process: "error",
      message: "Todos los campos son obligatorios.",
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
  jwt.verify(token, authConfig.secret, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
      });
    }
    // Get client_user_id by email
    pool.query(
      `SELECT us.id as user_id FROM users us WHERE us.username = $1`,
      [email],
      (err, result) => {
        if (err) {
          return res.status(500).json({
            process: "error",
            message: "Error al obtener solicitud de servicio.",
          });
        }
        if (result.rows.length === 0) {
          return res.status(404).json({
            process: "error",
            message: "El cliente no se encuentra registrado.",
          });
        }
        const client_user_id = result.rows[0].user_id;
        // Get request by client_user_id
        pool.query(
          `SELECT sr.id as service_request_id, sr.offer_id as offer_id, of."name" as offer_name,
              sr.status as status, sr.created_at as created_at,
              TO_CHAR(sr.created_at, 'Mon DD "de" YYYY') AS created_at_formmated,
              sr.assistant_code as assistant_code,
          CASE sr.assistant_code
              WHEN 'NO-CODE' THEN 'No aplica'
              ELSE (
                  SELECT pr."name"||' '||pr.last_name as seller_name
                  FROM referral_codes rc 
                  JOIN users us ON rc.seller_user_id = us.id
                  JOIN persons pr ON us.person_id = pr.id
                  AND rc.code = sr.assistant_code
              )
          END AS assited_by,
          src.code as order_number 
          FROM service_requests sr
          JOIN offers of ON sr.offer_id = of.id
          JOIN service_requests_code src ON src.service_request_id = sr.id
          WHERE sr.client_user_id = $1 order by sr.created_at desc`,
          [client_user_id],
          (err, result) => {
            if (err) {
              return res.status(500).json({
                process: "error",
                message: "Error al obtener solicitud de servicio.",
              });
            }
            return res.status(200).json({
              process: "success",
              message: "Solicitudes de servicio obtenida exitosamente.",
              count: result.rowCount,
              data: result.rows,
            });
          }
        );
      });
  });
};

// Get details service request
export const getServiceRequestDetails = (req, res) => {
  const { service_request_id } = req.body;
  if (!service_request_id) {
    return res.status(400).json({
      process: "error",
      message: "Todos los campos son obligatorios.",
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
  jwt.verify(token, authConfig.secret, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
      });
    }
    pool.query(
      `SELECT sr.id as service_request_id,
        of."name" as offer_name, of.description as offer_description, 
        '$' || REPLACE(TO_CHAR(of.price, 'FM999G999G999'), ',', '.') AS offer_price,
        TO_CHAR(sr.created_at, 'Mon DD "de" YYYY') AS created_at,
        sr.status as status, sr.assistant_code as assistant_code,
        CASE sr.assistant_code
                    WHEN 'NO-CODE' THEN 'Sin asesoramiento'
                    ELSE (
                    SELECT pr."name"||' '||pr.last_name as seller_name
                    FROM referral_codes rc 
                    JOIN users us ON rc.seller_user_id = us.id
                    JOIN persons pr ON us.person_id = pr.id
                    AND rc.code = sr.assistant_code
                    )
                END AS assited_by,
        src.code as order_number,
        op."name" as operator_name        
        FROM service_requests sr
        JOIN offers of ON sr.offer_id = of.id
        JOIN service_requests_code src ON src.service_request_id = sr.id
        JOIN operators op ON of.operator_id = op.id
        WHERE sr.id = $1`,
      [service_request_id],
      (err, result) => {
        if (err) {
          return res.status(500).json({
            process: "error",
            message: "Error al obtener solicitud de servicio.",
          });
        }
        return res.status(200).json({
          process: "success",
          message: "Solicitud de servicio obtenida exitosamente.",
          data: result.rows,
        });
      }
    );
  });
};

// Cancel service request by client email
export const cancelServiceRequestByClient = (req, res) => {
  const { service_request_id, email } = req.body;
  if (!service_request_id || !email) {
    return res.status(400).json({
      process: "error",
      message: "Todos los campos son obligatorios.",
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
  jwt.verify(token, authConfig.secret, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
      });
    }
    pool.query(
      `SELECT * FROM users WHERE username = $1 LIMIT 1`,
      [email],
      (err, result) => {
        if (err) {
          return res.status(500).json({
            process: "error",
            message: "Error al obtener solicitud de servicio.",
          });
        }
        if (result.rows.length === 0) {
          return res.status(404).json({
            process: "error",
            message: "El cliente no se encuentra registrado.",
          });
        }
        const client_user_id = result.rows[0].id;
        // Cancel service request
        pool.query(
          `UPDATE service_requests SET status = 'REJECTED_CLIENT' WHERE id = $1 AND client_user_id = $2`,
          [service_request_id, client_user_id],
          (err, result) => {
            if (err) {
              return res.status(500).json({
                process: "error",
                message: "Error al cancelar solicitud de servicio.",
              });
            }
            return res.status(200).json({
              process: "success",
              message: "Solicitud de servicio cancelada exitosamente.",
            });
          }
        );
      }
    );
  });
};

// Get service request by service coordinator email
// TODO: Revisar si es posible implementar el decoded.id
export const getServiceRequestByServiceCoordinator = (req, res) => {
  const { email } = req.body;
  if (
    !email ||
    email === "" ||
    email === null ||
    email === undefined
  ) {
    return res.status(400).json({
      process: "error",
      message: "Todos los campos son obligatorios.",
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
  jwt.verify(token, authConfig.secret, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        process: "session-expired",
        message:
          "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
      });
    }
    pool.query(
      `SELECT sr.id as service_request_id, sr.offer_id as offer_id, of."name" as offer_name,
           sr.status as status, sr.created_at as created_at,
              TO_CHAR(sr.created_at, 'Mon DD "de" YYYY') AS created_at_formmated,
              sr.assistant_code as assistant_code,
          CASE sr.assistant_code
              WHEN 'NO-CODE' THEN 'No aplica'
              ELSE (
                  SELECT pr."name"||' '||pr.last_name as seller_name
                  FROM referral_codes rc 
                  JOIN users us ON rc.seller_user_id = us.id
                  JOIN persons pr ON us.person_id = pr.id
                  AND rc.code = sr.assistant_code
              )
          END AS assited_by,
          src.code as order_number 
          FROM service_requests sr
          JOIN offers of ON sr.offer_id = of.id
          JOIN service_requests_code src ON src.service_request_id = sr.id
          JOIN assigned_service_requests asr ON asr.service_request_id = sr.id
          JOIN users usr ON asr.mkt_user_id = usr.id
          AND usr.username = $1 order by sr.created_at desc`,
      [email],
      (err, result) => {
        if (err) {
          return res.status(500).json({
            process: "error",
            message: "Error al obtener solicitud de servicio.",
          });
        }
        return res.status(200).json({
          process: "success",
          message: "Solicitudes de servicio obtenida exitosamente.",
          count: result.rowCount,
          data: result.rows,
        });
      }
    );
  });
};

// Add referral service request
export const addReferralServiceRequest = async (req, res) => {
  const { assigned_referral_code, email_service_coordinator, offer_id, filing_number } = req.body;
  let aux_filing_number = filing_number;
  if (filing_number === "" || filing_number === null || filing_number === undefined) {
    aux_filing_number = 'Pendiente';
  }
  if (!assigned_referral_code || !email_service_coordinator || !offer_id) {
    return res.status(400).json({
      process: "error",
      message: "Todos los campos son obligatorios.",
    });
  }

  const validateHasServiceRequestActive = await pool.query(
    `SELECT * FROM referral_service_requests WHERE assigned_referral_code = $1 
      AND service_request_state_id = (SELECT id FROM service_request_states WHERE status = 'IN_PROGRESS')`,
    [assigned_referral_code]
  );
  if (validateHasServiceRequestActive.rows.length > 0) {
    return res.status(400).json({
      process: "info",
      message: "Ya existe una solicitud de servicio activa con este código de referido.",
    });
  }

  const userExist = await getUserIdByEmail(email_service_coordinator);
  if (userExist.process === "error") {
    return res.status(400).json({
      process: "info",
      message: "Lo sentimos, no se pudo llevar a cabo la solicitud de servicio, intente nuevamente."
    });
  }
  pool.query(
    `INSERT INTO referral_service_requests (assigned_referral_code, coordinate_service_user, offer_id, service_request_state_id, created_by, filing_number) VALUES ($1, $2, $3, (SELECT id FROM service_request_states WHERE status = 'IN_PROGRESS'), $4, $5) RETURNING *`,
    [assigned_referral_code, userExist.id, offer_id, userExist.id, aux_filing_number],
    async (err, result) => {
      if (err) {
        return res.status(500).json({
          process: "error",
          message: "Error al agregar solicitud de servicio.",
        });
      }

      // Add comment to service request
      const comment = `Solicitud de servicio generada.`;
      const userSystemID = await getUserIdByEmail(getUserSystemEnv());
      const commentResult = await insertCommentToServiceRequest(result.rows[0].id, comment, userSystemID.id, true);
      if (commentResult.process === "error") {
        logger.error("RequestController.addReferralServiceRequest - Error al agregar comentario automatizado:", {
          error: commentResult.message,
          service_request_id: result.rows[0].id,
          comment,
          userSystemID: userSystemID.id,
          is_system: true
        });
      }

      const dataPersonReferral = await pool.query(
        `SELECT  
          prsRef.name || ' ' || COALESCE(prsRef.middle_name, '') || ' ' || prsRef.last_name AS referral_name, 
          prsCli.name || ' ' || COALESCE(prsCli.middle_name, '') || ' ' || prsCli.last_name AS client_name,
          usr.username AS referral_email, rsr.tracking_code AS order_number, prsCli.email AS client_email  
          FROM referral_service_requests rsr
            LEFT JOIN referred_clients rfc ON rsr.assigned_referral_code = rfc.code
            LEFT JOIN users usr ON usr.id = rfc.user_id
            LEFT JOIN persons prsRef ON prsRef.id = usr.person_id
            LEFT JOIN persons prsCli ON prsCli.id = rfc.person_id
          WHERE rsr.assigned_referral_code = $1
          AND service_request_state_id = (SELECT id FROM service_request_states WHERE status = 'IN_PROGRESS')`,
        [assigned_referral_code]
      );

      if (dataPersonReferral.rows.length === 0) {
        logger.error("RequestController.addReferralServiceRequest - Error al obtener datos de la persona para envío de correo electrónico:", {
          error: "No se encontraron datos de la persona.",
          assigned_referral_code,
          userExist: userExist.id,
          offer_id,
          aux_filing_number
        });
      }

      sendEmailV2(dataPersonReferral.rows[0].referral_email, "¡Buenas noticias! Nueva orden de servicio 🎉", "notification-request-generated", {
        referral_name: dataPersonReferral.rows[0].referral_name,
        client_name: dataPersonReferral.rows[0].client_name,
        order_number: dataPersonReferral.rows[0].order_number,
      });

      // Enviar correo electrónico al cliente
      sendEmailV2(dataPersonReferral.rows[0].client_email, "¡Buenas noticias! Nueva orden de servicio 🎉", "notification-request-generated-client", {
        referral_name: dataPersonReferral.rows[0].referral_name,
        client_name: dataPersonReferral.rows[0].client_name,
        order_number: dataPersonReferral.rows[0].order_number,
      });


      // const smsResult = await sendNotification({
      //   channel: NotificationChannels.SMS,
      //   to: "+573007858634",
      //   subject: `SIO|Colombia(TEST), se ha agregado una solicitud de servicio con el código de servicio ${assigned_referral_code}.`,
      //   message: `SIO|Colombia, se ha agregado una solicitud de servicio con el código de servicio ${assigned_referral_code}.`,
      //   metadata: {
      //     userId: userExist.id,
      //     type: "referral-service-request",
      //   },
      // });
      // console.log("SMS Result:", smsResult);

      return res.status(200).json({
        process: "success",
        message: "La solicitud de servicio ha sido generada.",
        data: result.rows,
      });
    }
  );

};

// Get referral service requests by coordiante service email
// TODO: Revisar si es posible implementar el decoded.id
export const getReferralServiceRequestsByUser = (req, res) => {
  const userID = req.user.id;
  pool.query(
    `SELECT rsr.id, rsr.assigned_referral_code referal_code, rsr.tracking_code AS code,
      rsr.offer_id, ofr.name offer_name, ofr.description offer_description, ofr.price offer_price, 
      rsr.filing_number,  
      sst.description state, rc.person_id,
        (
          SELECT prs.name || ' ' || COALESCE(prs.middle_name, '') || ' ' || prs.last_name 
          FROM persons prs WHERE prs.id = rc.person_id
        ) AS client_name
        FROM referral_service_requests rsr
        JOIN service_request_states sst ON rsr.service_request_state_id = sst.id
        JOIN referred_clients rc ON rsr.assigned_referral_code = rc.code
        JOIN offers ofr ON rsr.offer_id = ofr.id
        WHERE rsr.coordinate_service_user = $1
        AND rsr.is_active = TRUE`,
    [userID],
    async (err, result) => {
      if (err) {
        return res.status(500).json({
          process: "error",
          message: "Error al obtener solicitud de servicio.",
        });
      }

      const data = result.rows.map((row) => {
        return {
          service_request: {
            state: row.state,
            filing_number: row.filing_number,
            id: row.id,
          },
          client: {
            name: row.client_name,
            tracking_code: row.code,
            referral_code: row.referal_code,
          },
          offer: {
            id: row.offer_id,
            name: row.offer_name,
            description: row.offer_description,
            price: row.offer_price,
          },
        };
      });
      return res.status(200).json({
        process: "success",
        message: "Solicitud de servicio obtenida exitosamente.",
        count: result.rowCount,
        data,
      });
    }
  );

};

// Helper function to insert comment (reusable)
const insertCommentToServiceRequest = async (service_request_id, comment, user_id, is_system = false) => {
  return new Promise((resolve, reject) => {
    pool.query(
      `INSERT INTO comments_referral_service_request (referral_service_request_id, user_id, comment, created_by, is_system) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [service_request_id, user_id, comment, user_id, is_system],
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      }
    );
  });
};

// Add comment to service request
export const addCommentToServiceRequest = async (req, res) => {
  const { service_request_id, comment, email } = req.body;
  if (!service_request_id || !comment || !email) {
    return res.status(400).json({
      process: "error",
      message: "Todos los campos son obligatorios.",
    });
  }
  const userID = req.user.id;
  try {
    const result = await insertCommentToServiceRequest(service_request_id, comment, userID);
    return res.status(200).json({
      process: "success",
      message: "Comentario agregado exitosamente.",
      data: result.rows,
    });
  } catch (error) {
    logger.error("RequestController.addCommentToServiceRequest - Error al agregar comentario a solicitud de servicio:", {
      error,
      service_request_id,
      comment,
      user_id: req.user.id,
    });
    return res.status(500).json({
      process: "error",
      message: "Error al agregar comentario a solicitud de servicio.",
    });
  }
};

// Get comments and user by service_request_id
export const getCommentsAndUserByServiceRequestID = (req, res) => {
  const { service_request_id } = req.body;
  if (!service_request_id) {
    return res.status(400).json({
      process: "error",
      message: "Todos los campos son obligatorios.",
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
      WHERE com.referral_service_request_id = $1`,
    [service_request_id],
    (err, result) => {
      if (err) {
        logger.error("RequestController.getCommentsAndUserByServiceRequestID - Error al obtener comentarios de solicitud de servicio:", {
          error: err,
          service_request_id,
        });
        return res.status(500).json({
          process: "error",
          message: "Error al obtener comentarios de solicitud de servicio.",
        });
      }
      return res.status(200).json({
        process: "success",
        message: "Comentarios obtenidos exitosamente.",
        data: result.rows,
      });
    }
  );
};

// update state and add comment to service request
export const updateStateAndAddCommentToServiceRequest = async (req, res) => {
  const { service_request_id, state, comment, email } = req.body;
  if (!service_request_id || !state || !comment || !email) {
    return res.status(400).json({
      process: "error",
      message: "Todos los campos son obligatorios.",
    });
  };

  const userID = req.user.id;
  const stateID = await getServiceRequestStateIDByName(state);
  if (stateID.process === "error") {
    logger.error("RequestController.updateStateAndAddCommentToServiceRequest - Error al obtener ID de estado de solicitud de servicio a través del nombre:", {
      error_message: stateID.message,
      service_request_id,
      state,
      user_id: userID,
    });
    return res.status(400).json({
      process: "error",
      message: "Lo sentimos, la actualización del estado de la solicitud de servicio no se pudo llevar a cabo, intente nuevamente."
    });
  }

  let complementedQueryInactiveService = '';
  if (state === 'No aprobada') {
    complementedQueryInactiveService = `, is_active = false`;
  }

  pool.query(
    `UPDATE referral_service_requests SET service_request_state_id = $1, updated_by = $2 ${complementedQueryInactiveService} WHERE id = $3 RETURNING *`,
    [stateID.id, userID, service_request_id],
    async (err, result) => {
      if (err) {
        logger.error("RequestController.updateStateAndAddCommentToServiceRequest - Error al actualizar estado de solicitud de servicio:", {
          error: err,
          service_request_id,
          state,
          user_id: userID,
        });
        return res.status(500).json({
          process: "error",
          message: "Error al actualizar estado de solicitud de servicio.",
        });
      }

      const commentResult = await insertCommentToServiceRequest(service_request_id, comment, userID);
      if (commentResult.process === "error") {
        logger.error("RequestController.updateStateAndAddCommentToServiceRequest - Error al agregar comentario a solicitud de servicio:", {
          error: commentResult.error,
          service_request_id,
          comment,
          user_id: userID,
        });
        return res.status(400).json({ process: "error", message: "Lo sentimos, no se pudo llevar a cabo el registro del comentario (US-002)." });
      }

      const dataReferral = await pool.query(
        `SELECT  
          prsRef.name || ' ' || COALESCE(prsRef.middle_name, '') || ' ' || prsRef.last_name AS referral_name, 
          usr.username AS referral_email  
          FROM referral_service_requests rsr
            LEFT JOIN referred_clients rfc ON rsr.assigned_referral_code = rfc.code
            LEFT JOIN users usr ON usr.id = rfc.user_id
            LEFT JOIN persons prsRef ON prsRef.id = usr.person_id
          WHERE rsr.id = $1`,
        [result.rows[0].id]
      );

      if (dataReferral.rows.length === 0) {
        logger.error("RequestController.updateStateAndAddCommentToServiceRequest - Error al obtener datos del referido para envío de correo electrónico :", {
          error: "No se encontraron datos del referido.",
          service_request_id: result.rows[0].id,
        });
      }

      // Send email to referral
      const email = dataReferral.rows[0].referral_email
      sendEmailV2(email, "Actualización: Tu orden de servicio 📝", "notification-update-request", {
        referral_name: dataReferral.rows[0].referral_name,
        order_number: result.rows[0].tracking_code,
        new_status: stateID.description,
      });


      // const smsResult = await sendNotification({
      //   channel: NotificationChannels.SMS,
      //   to: "+573007858634",
      //   subject: `SIO|Colombia(TEST), la orden de servicio ${result.rows[0].tracking_code} cambió a estado ${stateID.description}.`,
      //   message: `SIO|Colombia, ${stateID.description.toLowerCase() === 'terminada'
      //     ? `La orden de servicio ${result.rows[0].tracking_code} ha sido finalizada con éxito, gracias por tu preferencia.`
      //     : `La orden de servicio ${result.rows[0].tracking_code} ha cambiado al estado ${stateID.description} y sigue en proceso.`}`,
      //   metadata: {
      //     userId: userID,
      //     type: "referral-service-request",
      //   },
      // });
      // console.log("SMS Result:", smsResult);

      return res.status(200).json({
        process: "success",
        message: "La actualización del estado de la solicitud de servicio se realizó exitosamente.",
        data: result.rows,
      });
    }
  );

};

// update filling_number by tracking_code
// RQC-AC-013
export const updateOnlyFillingNumberByTrackingCode = (req, res) => {
  const { tracking_code, filling_number } = req.body;
  if (!tracking_code || !filling_number) {
    return res.status(400).json({
      process: "error",
      message: "Todos los campos son obligatorios.",
    });
  }
  const userID = req.user.id;
  pool.query(
    `UPDATE referral_service_requests SET filing_number = $1, updated_by = $2 WHERE tracking_code = $3 and is_active = true RETURNING *`,
    [filling_number, userID, tracking_code],
    async (err, result) => {
      if (err) {
        return res.status(500).json({
          process: "error",
          message: "Error al actualizar número de radicado (RQC-AC-013.01).",
        });
      }

      const commentResult = await insertCommentToServiceRequest(result.rows[0].id, `Número de radicado actualizado: ${filling_number}`, userID);
      if (commentResult.process === "error") {
        logger.error("RequestController.updateOnlyFillingNumberByTrackingCode - Error al agregar un comentario a la solicitud de servicio que se le actualizó el número de radicado:", {
          error: commentResult.error,
          service_request_id: result.rows[0].id,
          comment: `Número de radicado actualizado: ${filling_number}`,
          user_id: userID,
        });
        return res.status(400).json({
          process: "error",
          message: "Lo sentimos, no se pudo llevar a cabo el registro del comentario (RQC-AC-013.02)."
        });
      }
      return res.status(200).json({
        process: "success",
        message: "Número de radicado actualizado exitosamente.",
        data: result.rows,
      });
    }
  );
};


// TODO: Guardar esta consulta
/*
SELECT rco.commission_amount, 
'$ ' || REPLACE(
      TO_CHAR(rco.commission_amount, 'FM999,999,999,990'),
      ',', '.'
) AS commission_amount_formmated,
-- rco.created_at, 
TO_CHAR(
  rco.created_at,
  'Mon FMDD "de" YYYY'
) AS created_at_formatted,
rco.base_amount, 
'$ ' || REPLACE(
      TO_CHAR(rco.base_amount, 'FM999,999,999,990'),
      ',', '.'
) AS base_amount_formmated,
rco.commission_type, rco.commission_value, 
CASE 
    WHEN rco.commission_type = 'PERCENTAGE' THEN 
        TO_CHAR(rco.commission_value, 'FM999G999G990') || '%'
        
    WHEN rco.commission_type = 'FIXED' THEN 
        '$' || REPLACE(
            TO_CHAR(rco.commission_value, 'FM999,999,999,990'),
            ',', '.'
        )
END AS commission_value_formmated,
rsr.assigned_referral_code, 
ofr."name" AS offer_name, ofr.description AS offer_description, 
opr."name" AS operator_name, 
prs.name || ' ' || COALESCE(prs.middle_name, '') || ' ' || prs.last_name as client_name
FROM users usr
JOIN referral_commissions rco ON rco.user_id = usr.id
JOIN referral_service_requests rsr ON rsr.id = rco.referral_service_request_id
JOIN offers ofr ON ofr.id = rsr.offer_id 
JOIN operators opr ON opr.id = ofr.operator_id
JOIN referred_clients rcl ON rcl.code = rsr.assigned_referral_code
JOIN persons prs ON prs.id = rcl.person_id
WHERE usr.username = 'rv@c.com' AND status = 'AVAILABLE'  
*/
