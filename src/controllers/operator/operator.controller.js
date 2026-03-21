import jwt from "jsonwebtoken";
import pool from "../../config/db.config.js";
import authConfig from "../../config/auth.config.js";

// Get operators, no authentication required
export const getOperators = (req, res) => {
  pool.query(
    "SELECT * FROM operators WHERE is_active = true",
    (err, result) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Error al consultar operadores." });
      }
      res.json({
        process: "success",
        message: "Operadores obtenidos exitosamente.",
        count: result.rowCount,
        data: result.rows,
      });
    }
  );
};