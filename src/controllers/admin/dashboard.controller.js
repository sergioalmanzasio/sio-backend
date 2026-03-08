import pool from "../../config/db.config.js";
import { userWithPermissions } from "../common/common.controller.js";

// DC-AC-001
export const getTotalActiveUsers = async (req, res) => {
  try {
    const token = req.cookies.token;
    const validateUserWithPermissions = await userWithPermissions(token);
    if (validateUserWithPermissions.process !== "success") {
      return res.status(401).json({
        process: validateUserWithPermissions.process,
        message: validateUserWithPermissions.message,
      });
    }

    pool.query(`SELECT COUNT(*) as total FROM users usr WHERE usr.is_active = TRUE`,
      (err, result) => {
        if (err) {
          return res.status(200).json({
            process: "success",
            message: "Lo sentimos, no se pudo obtener el total de usuarios registrados, inténtelo más tarde. (RC-AC-006).",
            data: 0,
          });
        }

        if (result.rows.length === 0) {
          return res.status(200).json({
            process: "success",
            message: "No hay usuarios activos",
            data: 0,
          });
        }

        return res.status(200).json({
          process: "success",
          message: "Total de usuarios registrados obtenidos exitosamente.",
          data: result.rows[0].total,
        });
      }
    );
  } catch (error) {
    console.log("ERROR GLOBAL getUserRegistered: ", error);

    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo obtener el total de usuarios registrados, inténtelo más tarde. (RC-AC-006).",
    });
  }
}

// DC-AC-002
// SELECT count(*) FROM referral_service_requests
export const getTotalReferralServiceRequests = async (req, res) => {
  try {
    const token = req.cookies.token;
    const validateUserWithPermissions = await userWithPermissions(token);
    if (validateUserWithPermissions.process !== "success") {
      return res.status(401).json({
        process: validateUserWithPermissions.process,
        message: validateUserWithPermissions.message,
      });
    }

    pool.query(`SELECT COUNT(*) as total FROM referral_service_requests`,
      (err, result) => {
        if (err) {
          return res.status(200).json({
            process: "success",
            message: "Lo sentimos, no se pudo obtener el total de solicitudes de servicios, inténtelo más tarde. (RC-AC-006).",
            data: 0,
          });
        }

        if (result.rows.length === 0) {
          return res.status(200).json({
            process: "success",
            message: "No hay solicitudes de servicios",
            data: 0,
          });
        }

        return res.status(200).json({
          process: "success",
          message: "Total de solicitudes de servicios obtenidos exitosamente.",
          data: result.rows[0].total,
        });
      }
    );
  } catch (error) {
    console.log("ERROR GLOBAL getTotalReferralServiceRequests: ", error);

    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo obtener el total de solicitudes de servicios, inténtelo más tarde. (RC-AC-006).",
    });
  }
}

// DC-AC-003
// SELECT count(*) FROM referral_commissions WHERE status = 'PAID'
export const getTotalPaidReferralCommissions = async (req, res) => {
  try {
    const token = req.cookies.token;
    const validateUserWithPermissions = await userWithPermissions(token);
    if (validateUserWithPermissions.process !== "success") {
      return res.status(401).json({
        process: validateUserWithPermissions.process,
        message: validateUserWithPermissions.message,
      });
    }

    pool.query(`SELECT 
                '$ ' || REPLACE(
                    TO_CHAR(
                        COALESCE(SUM(commission_amount), 0),
                        'FM999,999,999,990'
                    ),
                    ',', '.'
                ) AS total
              FROM referral_commissions
              WHERE status = 'PAID'`,
      (err, result) => {
        if (err) {
          return res.status(200).json({
            process: "success",
            message: "Lo sentimos, no se pudo obtener el total de comisiones pagadas, inténtelo más tarde. (RC-AC-006).",
            data: 0,
          });
        }

        if (result.rows.length === 0) {
          return res.status(200).json({
            process: "success",
            message: "No hay comisiones pagadas",
            data: 0,
          });
        }

        return res.status(200).json({
          process: "success",
          message: "Total de comisiones pagadas obtenidos exitosamente.",
          data: result.rows[0].total,
        });
      }
    );
  } catch (error) {
    console.log("ERROR GLOBAL getTotalPaidReferralCommissions: ", error);

    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo obtener el total de comisiones pagadas, inténtelo más tarde. (RC-AC-006).",
    });
  }
}

// DC-AC-004
export const getTotalPendingReferralServiceRequests = async (req, res) => {
  try {
    const token = req.cookies.token;
    const validateUserWithPermissions = await userWithPermissions(token);
    if (validateUserWithPermissions.process !== "success") {
      return res.status(401).json({
        process: validateUserWithPermissions.process,
        message: validateUserWithPermissions.message,
      });
    }

    pool.query(`SELECT COUNT(*) as total FROM referral_service_requests srs 
                JOIN service_request_states sst ON srs.service_request_state_id = sst.id 
                WHERE sst.status in ('IN_PROGRESS','PENDING')`,
      (err, result) => {
        if (err) {
          return res.status(200).json({
            process: "success",
            message: "Lo sentimos, no se pudo obtener el total de solicitudes de servicios pendientes, inténtelo más tarde. (RC-AC-006).",
            data: 0,
          });
        }

        if (result.rows.length === 0) {
          return res.status(200).json({
            process: "success",
            message: "No hay solicitudes de servicios pendientes",
            data: 0,
          });
        }

        return res.status(200).json({
          process: "success",
          message: "Total de solicitudes de servicios pendientes obtenidos exitosamente.",
          data: result.rows[0].total,
        });
      }
    );
  } catch (error) {
    console.log("ERROR GLOBAL getTotalPendingReferralServiceRequests: ", error);

    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo obtener el total de solicitudes de servicios pendientes, inténtelo más tarde. (RC-AC-006).",
    });
  }
}

// DC-AC-005
export const getTotalServiceRequestsByMonth = async (req, res) => {
  try {
    const token = req.cookies.token;
    const validateUserWithPermissions = await userWithPermissions(token);
    if (validateUserWithPermissions.process !== "success") {
      return res.status(401).json({
        process: validateUserWithPermissions.process,
        message: validateUserWithPermissions.message,
      });
    }

    pool.query(`SELECT 
                INITCAP(
                    CASE EXTRACT(MONTH FROM gs.mes)
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
                ) || ' ' || EXTRACT(YEAR FROM gs.mes) AS mes,

                COALESCE(COUNT(srs.created_at), 0) AS cantidad

            FROM generate_series(
                    DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
                    DATE_TRUNC('month', CURRENT_DATE),
                    INTERVAL '1 month'
                ) AS gs(mes)

            LEFT JOIN referral_service_requests srs
                ON DATE_TRUNC('month', srs.created_at) = gs.mes

            GROUP BY gs.mes
            ORDER BY gs.mes DESC;`,
      (err, result) => {
        if (err) {
          return res.status(200).json({
            process: "success",
            message: "Lo sentimos, no se pudo obtener el total de solicitudes de servicios por mes, inténtelo más tarde. (RC-AC-006).",
            data: 0,
          });
        }

        if (result.rows.length === 0) {
          return res.status(200).json({
            process: "success",
            message: "No hay solicitudes de servicios por mes",
            data: 0,
          });
        }

        return res.status(200).json({
          process: "success",
          message: "Total de solicitudes de servicios por mes obtenidos exitosamente.",
          data: result.rows,
        });
      }
    );
  } catch (error) {
    console.log("ERROR GLOBAL getTotalServiceRequestsByMonth: ", error);

    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo obtener el total de solicitudes de servicios por mes, inténtelo más tarde. (RC-AC-006).",
    });
  }
}

// DC-AC-006
export const getTotalPaidCommissionsByMonth = async (req, res) => {
  try {
    const token = req.cookies.token;
    const validateUserWithPermissions = await userWithPermissions(token);
    if (validateUserWithPermissions.process !== "success") {
      return res.status(401).json({
        process: validateUserWithPermissions.process,
        message: validateUserWithPermissions.message,
      });
    }

    pool.query(`SELECT 
                INITCAP(
                    CASE EXTRACT(MONTH FROM gs.mes)
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
                ) || ' ' || EXTRACT(YEAR FROM gs.mes) AS mes,

                COALESCE(SUM(rc.commission_amount), 0) AS total

            FROM generate_series(
                    DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
                    DATE_TRUNC('month', CURRENT_DATE),
                    INTERVAL '1 month'
                ) AS gs(mes)

            LEFT JOIN referral_commissions rc
                ON DATE_TRUNC('month', rc.created_at) = gs.mes
                AND rc.status = 'PAID'
            GROUP BY gs.mes
            ORDER BY gs.mes DESC;`,
      (err, result) => {
        if (err) {
          return res.status(200).json({
            process: "success",
            message: "Lo sentimos, no se pudo obtener el total de comisiones pagadas por mes, inténtelo más tarde. (RC-AC-006).",
            data: 0,
          });
        }

        if (result.rows.length === 0) {
          return res.status(200).json({
            process: "success",
            message: "No hay comisiones pagadas por mes",
            data: 0,
          });
        }

        return res.status(200).json({
          process: "success",
          message: "Total de comisiones pagadas por mes obtenidos exitosamente.",
          data: result.rows,
        });
      }
    );
  } catch (error) {
    console.log("ERROR GLOBAL getTotalPaidReferralCommissionsByMonth: ", error);

    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo obtener el total de comisiones pagadas por mes, inténtelo más tarde. (RC-AC-006).",
    });
  }
}

// DC-AC-007
export const getTotalUsersByRole = async (req, res) => {
  try {
    const token = req.cookies.token;
    const validateUserWithPermissions = await userWithPermissions(token);
    if (validateUserWithPermissions.process !== "success") {
      return res.status(401).json({
        process: validateUserWithPermissions.process,
        message: validateUserWithPermissions.message,
      });
    }

    pool.query(`SELECT 
                ro.name AS role_name,
                COUNT(usr.id) AS total_usuarios
            FROM users usr
            JOIN user_roles uro 
                ON uro.user_id = usr.id
            JOIN roles ro 
                ON uro.role_id = ro.id
            WHERE usr.is_active = TRUE
            GROUP BY ro.name
            ORDER BY total_usuarios DESC;`,
      (err, result) => {
        if (err) {
          return res.status(200).json({
            process: "success",
            message: "Lo sentimos, no se pudo obtener el total de usuarios por rol, inténtelo más tarde. (RC-AC-006).",
            data: 0,
          });
        }

        if (result.rows.length === 0) {
          return res.status(200).json({
            process: "success",
            message: "No hay usuarios por rol",
            data: 0,
          });
        }

        return res.status(200).json({
          process: "success",
          message: "Total de usuarios por rol obtenidos exitosamente.",
          data: result.rows,
        });
      }
    );
  } catch (error) {
    console.log("ERROR GLOBAL getTotalUsersByRole: ", error);

    return res.status(500).json({
      process: "error",
      message: "Lo sentimos, no se pudo obtener el total de usuarios por rol, inténtelo más tarde. (RC-AC-006).",
    });
  }
}



