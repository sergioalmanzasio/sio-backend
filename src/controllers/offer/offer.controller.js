import jwt from "jsonwebtoken";
import pool from "../../config/db.config.js";
import authConfig from "../../config/auth.config.js";

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
    JOIN operators op ON op.id = o.operator_id order by o.price asc`,
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
    WHERE c.id = $1`,
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
  console.log('------> ', operator_id, service_id);
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
    WHERE op.id = $1 AND c.id = $2`,
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