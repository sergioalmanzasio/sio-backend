import pool from "../../config/db.config.js";
import { getUserIdByToken } from "../common/common.controller.js";

// Dashboard: obtener cantidad de solicitudes por estado
export const getServiceRequestCountByState = async (req, res) => {
 try {
  const user = await getUserIdByToken(req);
  if (user.process !== "success") {
   return res.status(401).json({
    process: user.process,
    message: user.message,
   });
  }


  const { status } = req.query;
  console.log("STATUS", status);

  if (!status) {
   return res.status(400).json({
    process: "error",
    message: "El parámetro 'status' es obligatorio.",
   });
  }

  const isTotal = status.toLowerCase() === "total";

  const result = await pool.query(
   `SELECT 
          sta.description AS estado,
          COALESCE(COUNT(rsr.id), 0) AS cantidad
        FROM service_request_states sta
        LEFT JOIN referral_service_requests rsr 
          ON rsr.service_request_state_id = sta.id
          AND rsr.coordinate_service_user = $1
        GROUP BY sta.id, sta.description
        ORDER BY sta.description`,
   [user.id]
  );

  if (isTotal) {
   let total = 0;
   result.rows.forEach((row) => {
    total += parseInt(row.cantidad, 10);
   });

   return res.status(200).json({
    process: "success",
    message: "Total de solicitudes obtenido exitosamente.",
    data: {
     estado: "total",
     count: total,
    }
   });
  }

  // Filtrar por el estado recibido
  const filtered = result.rows.find(
   (row) => row.estado.toLowerCase() === status.toLowerCase()
  );

  if (!filtered) {
   return res.status(200).json({
    process: "info",
    message: `No se encontró el estado '${status}'.`,
    data: { estado: status, count: 0 },
   });
  }

  return res.status(200).json({
   process: "success",
   message: "Cantidad obtenida exitosamente.",
   data: {
    estado: filtered.estado,
    count: parseInt(filtered.cantidad, 10),
   },
  });
 } catch (err) {
  console.log("ERROR getServiceRequestCountByState:", err);
  return res.status(500).json({
   process: "error",
   message: "Lo sentimos, no se pudo obtener la información, inténtelo más tarde.",
  });
 }
};

// Dashboard: obtener cantidad de solicitudes por mes (últimos 6 meses incluyendo el actual)
export const getServiceRequestCountByMonth = async (req, res) => {
 try {
  const user = await getUserIdByToken(req);
  if (user.process !== "success") {
   return res.status(401).json({
    process: user.process,
    message: user.message,
   });
  }

  const result = await pool.query(
   `SELECT 
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
        COALESCE(COUNT(rsr.id), 0) AS cantidad
    FROM generate_series(
            DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
            DATE_TRUNC('month', CURRENT_DATE),
            INTERVAL '1 month'
        ) AS gs(mes)
    LEFT JOIN referral_service_requests rsr
        ON DATE_TRUNC('month', rsr.created_at) = gs.mes
        AND rsr.coordinate_service_user = $1
    GROUP BY gs.mes
    ORDER BY gs.mes DESC`,
   [user.id]
  );

  if (result.rows.length === 0) {
   return res.status(200).json({
    process: "success",
    message: "No hay solicitudes de servicios por mes.",
    data: [],
   });
  }

  return res.status(200).json({
   process: "success",
   message: "Solicitudes por mes obtenidas exitosamente.",
   data: result.rows,
  });
 } catch (err) {
  console.log("ERROR getServiceRequestCountByMonth:", err);
  return res.status(500).json({
   process: "error",
   message: "Lo sentimos, no se pudo obtener la información, inténtelo más tarde.",
  });
 }
};
