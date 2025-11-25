import jwt from "jsonwebtoken";
import pool from "../../config/db.config.js";
import authConfig from "../../config/auth.config.js";
import { sendEmail } from "../../utils/shared.js";

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
                serviceRequestCode =
                  resultRequestCode.rows[0].code.split("-")[1];
                // TODO: Enviar correo al cliente con el código de orden de servicio

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
      `SELECT * FROM users WHERE username = $1`,
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
          WHERE sr.client_user_id = $1`,
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