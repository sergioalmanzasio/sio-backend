import jwt from "jsonwebtoken";
import pool from "../../config/db.config.js";
import authConfig from "../../config/auth.config.js";
import { sendEmail } from "../../utils/shared.js";

// Add service_request
export const addServiceRequest = (req, res) => {
	 
    const { email, offer_id, is_assisted, assistant_code } = req.body;
		
    if (!email || !offer_id || is_assisted === 'undefined' || !assistant_code) { // is_assisted = false how to validate?
      return res
          .status(400)
          .json({
						process: "error",
              message: "Todos los campos son obligatorios.",
          });
    }
    const token = req.cookies.token;
    if (!token) {
      return res
          .status(401)
          .json({
            process: "session-expired",
            message: "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando.",
          });
    }
    jwt.verify(token, authConfig.secret, (err, decoded) => {
      if (err) {
          return res
            .status(401)
            .json({
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
              return res
                .status(500)
                .json({
                  process: "error",
                  message: "Error al agregar solicitud de servicio.",
                });
            }
            if (result.rows.length === 0) {
              return res
								.status(404)
								.json({
                  process: "error",
                  message: "El cliente no se encuentra registrado.",
                });
            }
            const client_user_id = result.rows[0].user_id;
						const person_name = result.rows[0].person_name;
						let serviceRequestCode = ''
            pool.query(
							`INSERT INTO service_requests (client_user_id, offer_id, is_assisted, assistant_code, created_by, updated_by)
							VALUES ($1, $2, $3, $4, $5, $6)
							RETURNING *`,
							[client_user_id, offer_id, is_assisted, assistant_code, client_user_id, client_user_id],
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
									[client_user_id, result.rows[0].id, client_user_id, client_user_id],
									async (err, resultRequestCode) => {
										if (err) {
											return res
												.status(500)
												.json({ message: "Error al agregar código de solicitud de servicio." });
										}
										serviceRequestCode = resultRequestCode.rows[0].code.split('-')[1];
										// TODO: Enviar correo al cliente con el código de orden de servicio	
								
										const sendEmailRegisterUserAssistant = await sendEmail(email, 'Confirmación de Orden de Servicio', serviceRequestCode, person_name, email, 'notification-client-service-request');
										if (!sendEmailRegisterUserAssistant) {
											return res.status(500).send({
												process: "error",
												message: "Error al enviar correo de bienvenida a SIO al asesor.",
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
      return res
          .status(400)
          .json({
              message: "El campo email es obligatorio.",
          });
    }
    const token = req.cookies.token;
    if (!token) {
      return res
          .status(401)
          .json({
						process: "session-expired",
              message: "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando.",
          });
    }
    jwt.verify(token, authConfig.secret, (err, decoded) => {
      if (err) {
          return res
            .status(401)
            .json({
								process: "session-expired",
								message: "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
            });
      }
      // Get client_user_id by email
      pool.query(
          `SELECT * FROM users WHERE username = $1`,
          [email],
          (err, result) => {
              if (err) {
                  return res
                      .status(500)
                      .json({ 
                        hasPendingRequest: false,
                        message: "Error al validar solicitud de servicio." 
                      });
              }
              if (result.rows.length === 0) {
                  return res
                      .status(404)
                      .json({ 
                        hasPendingRequest: false,
                        message: "El cliente no se encuentra registrado." 
                      });
              }
              const client_user_id = result.rows[0].id;
              // Validate if client_user_id has a pending request
              pool.query(
                `SELECT * FROM service_requests WHERE client_user_id = $1 AND status = 'PENDING'`,
                [client_user_id],
                (err, result) => {
                    if (err) {
                        return res
                            .status(500)
                            .json({ 
                              hasPendingRequest: false,
                              message: "Error al validar solicitud de servicio." 
                            });
                    }
                    if (result.rows.length > 0) {
                        return res
                            .status(400)
                            .json({ 
                              hasPendingRequest: true,
                              message: "Ya tiene una solicitud en proceso. No puede adquirir otra oferta hasta que se complete la actual." 
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


