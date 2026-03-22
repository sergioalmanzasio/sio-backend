import jwt from "jsonwebtoken";
import pool from "../../config/db.config.js";
import authConfig from "../../config/auth.config.js";
import { logger } from "../../utils/logger.js";

// Get offers, authentication required
export const getOffersRestricted = (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res
      .status(401)
      .json({
        message:
          "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando.",
      });
  }
  jwt.verify(token, authConfig.secret, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .json({
          message:
            "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
        });
    }
    pool.query(
      `SELECT
          o.id AS offer_id,
          o.name AS offer_name,
          o.description AS offer_description,
          o.price,
          o.is_active,

          c.id AS category_id,
          c.name AS category_name,

          op.id AS operator_id,
          op.name AS operator_name

      FROM offers o
      JOIN categories_offers co ON co.offer_id = o.id
      JOIN categories c ON c.id = co.category_id
      JOIN operators op ON op.id = o.operator_id`,
      (err, result) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Error al consultar ofertas." });
        }
        res.json({
          process: "success",
          message: "Ofertas obtenidas exitosamente.",
          count: result.rowCount,
          data: result.rows,
        });
      }
    );
  });
};

// Get offers, no authentication required
export const getOffers = (req, res) => {
  pool.query(
    `SELECT
        o.id AS offer_id,
        o.name AS offer_name,
        o.description AS offer_description,
        '$' || REPLACE(TO_CHAR(o.price, 'FM999G999G999'), ',', '.') AS price_formatted,
        o.is_active,

        c.id AS category_id,
        c.name AS category_name,

        op.id AS operator_id,
        op.name AS operator_name

    FROM offers o
    JOIN categories_offers co ON co.offer_id = o.id
    JOIN categories c ON c.id = co.category_id
    JOIN operators op ON op.id = o.operator_id 
    WHERE o.is_active = TRUE AND CURRENT_DATE BETWEEN o.date_start AND o.date_end
    order by o.price asc`,
    (err, result) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Error al consultar ofertas." });
      }
      res.json({
        process: "success",
        message: "Ofertas obtenidas exitosamente.",
        count: result.rowCount,
        data: result.rows,
      });
    }
  );
};

// Get offer by operator id, authentication required
export const getOfferByOperatorIdRestricted = (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res
      .status(401)
      .json({
        message: "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando.",
      });
  }
  jwt.verify(token, authConfig.secret, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .json({
          message:
            "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
        });
    }
    const { operator_id } = req.params;
    pool.query(
      `SELECT
          o.id AS offer_id,
          o.name AS offer_name,
          o.description AS offer_description,
          '$' || REPLACE(TO_CHAR(o.price, 'FM999G999G999'), ',', '.') AS price_formatted,
          o.is_active,

          c.id AS category_id,
          c.name AS category_name,

          op.id AS operator_id,
          op.name AS operator_name

      FROM offers o
      JOIN categories_offers co ON co.offer_id = o.id
      JOIN categories c ON c.id = co.category_id
      JOIN operators op ON op.id = o.operator_id
      WHERE op.id = $1`,
      [operator_id],
      (err, result) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Error al consultar ofertas." });
        }
        res.json({
          process: "success",
          message: "Ofertas obtenidas exitosamente.",
          count: result.rowCount,
          data: result.rows,
        });
      }
    );
  });
};

// Get offer by operator id, no authentication required
export const getOfferByOperatorId = (req, res) => {
  const { operator_id } = req.params;
  pool.query(
    `SELECT
        o.id AS offer_id,
        o.name AS offer_name,
        o.description AS offer_description,
        '$' || REPLACE(TO_CHAR(o.price, 'FM999G999G999'), ',', '.') AS price_formatted,
        o.is_active,

        c.id AS category_id,
        c.name AS category_name,

        op.id AS operator_id,
        op.name AS operator_name

    FROM offers o
    JOIN categories_offers co ON co.offer_id = o.id
    JOIN categories c ON c.id = co.category_id
    JOIN operators op ON op.id = o.operator_id
    WHERE op.id = $1 AND o.is_active = TRUE
    AND CURRENT_DATE BETWEEN o.date_start AND o.date_end`,
    [operator_id],
    (err, result) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Error al consultar ofertas." });
      }
      res.json({
        process: "success",
        message: "Ofertas obtenidas exitosamente.",
        count: result.rowCount,
        data: result.rows,
      });
    }
  );

};

// Get offer by category id, authentication required
export const getOfferByCategoryIdRestricted = (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res
      .status(401)
      .json({
        message: "Por seguridad, tu sesión ha caducado. Accede nuevamente a SIO para seguir navegando.",
      });
  }
  jwt.verify(token, authConfig.secret, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .json({
          message:
            "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad.",
        });
    }
    const { category_id } = req.params;
    pool.query(
      `SELECT
          o.id AS offer_id,
          o.name AS offer_name,
          o.description AS offer_description,
          '$' || REPLACE(TO_CHAR(o.price, 'FM999G999G999'), ',', '.') AS price_formatted,
          o.is_active,

          c.id AS category_id,
          c.name AS category_name,

          op.id AS operator_id,
          op.name AS operator_name

      FROM offers o
      JOIN categories_offers co ON co.offer_id = o.id
      JOIN categories c ON c.id = co.category_id
      JOIN operators op ON op.id = o.operator_id
      WHERE c.id = $1`,
      [category_id],
      (err, result) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Error al consultar ofertas." });
        }
        res.json({
          process: "success",
          message: "Ofertas obtenidas exitosamente.",
          count: result.rowCount,
          data: result.rows,
        });
      }
    );
  });
};

// Get offer by service id, no authentication required
export const getOfferByServiceId = (req, res) => {
  const { service_id } = req.params;
  pool.query(
    `SELECT
        o.id AS offer_id,
        o.name AS offer_name,
        o.description AS offer_description,
        '$' || REPLACE(TO_CHAR(o.price, 'FM999G999G999'), ',', '.') AS price_formatted,
        o.is_active,

        c.id AS category_id,
        c.name AS category_name,

        op.id AS operator_id,
        op.name AS operator_name

    FROM offers o
    JOIN categories_offers co ON co.offer_id = o.id
    JOIN categories c ON c.id = co.category_id
    JOIN operators op ON op.id = o.operator_id
    WHERE c.id = $1 AND o.is_active = TRUE
    AND CURRENT_DATE BETWEEN o.date_start AND o.date_end`,
    [service_id],
    (err, result) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Error al consultar ofertas." });
      }
      res.json({
        process: "success",
        message: "Ofertas obtenidas exitosamente.",
        count: result.rowCount,
        data: result.rows,
      });
    }
  );
};

// Get offer by operator id and category id, no authentication required
export const getOfferByOperatorIdAndServiceId = (req, res) => {
  const { operator_id, service_id } = req.params;
  pool.query(
    `SELECT
        o.id AS offer_id,
        o.name AS offer_name,
        o.description AS offer_description,
        '$' || REPLACE(TO_CHAR(o.price, 'FM999G999G999'), ',', '.') AS price_formatted,
        o.is_active,

        c.id AS category_id,
        c.name AS category_name,

        op.id AS operator_id,
        op.name AS operator_name

    FROM offers o
    JOIN categories_offers co ON co.offer_id = o.id
    JOIN categories c ON c.id = co.category_id
    JOIN operators op ON op.id = o.operator_id
    WHERE op.id = $1 AND c.id = $2 AND o.is_active = TRUE
    AND CURRENT_DATE BETWEEN o.date_start AND o.date_end`,
    [operator_id, service_id],
    (err, result) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Error al consultar ofertas." });
      }
      res.json({
        process: "success",
        message: "Ofertas obtenidas exitosamente.",
        count: result.rowCount,
        data: result.rows,
      });
    }
  );
};

// Get compensation by operator id and category id, no authentication required
export const getCompensationOffers = (req, res) => {
  pool.query(
    `SELECT 
        opr.name AS operator_name,
        cat.name AS service_type,
        MAX(occ.commission_value) AS commission,
        '$ ' || REPLACE(
        TO_CHAR(MAX(occ.commission_value), 'FM999,999,999,990'),
        ',', '.'
      ) AS commission_value_forrmtaed
    FROM offer_commission_config occ
    LEFT JOIN offers off ON off.id = occ.offer_id
    LEFT JOIN categories_offers cto ON cto.offer_id = off.id
    LEFT JOIN categories cat ON cat.id = cto.category_id
    LEFT JOIN operators opr ON opr.id = off.operator_id
    GROUP BY opr.name, cat.name
    ORDER BY opr.name, cat.name`,
    (err, result) => {
      if (err) {
        logger.error('OfferController.getCompensationOffers - Error consulta ofertas: ', err);
        return res
          .status(500)
          .json({ message: "Error al consultar ofertas." });
      }
      const data = result.rows.reduce((acc, row) => {
        const operator = acc.find((op) => op.operator_name === row.operator_name);
        if (!operator) {
          acc.push({
            operator_name: row.operator_name,
            services: [
              {
                service_type: row.service_type,
                commission: row.commission,
                commission_value_forrmtaed: row.commission_value_forrmtaed,
              },
            ],
          });
        } else {
          operator.services.push({
            service_type: row.service_type,
            commission: row.commission,
            commission_value_forrmtaed: row.commission_value_forrmtaed,
          });
        }
        return acc;
      }, []);
      res.json({
        process: "success",
        message: "Ofertas obtenidas exitosamente.",
        count: result.rowCount,
        data: data,
      });
    }
  );
};
