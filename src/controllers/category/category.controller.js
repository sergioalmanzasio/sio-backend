import jwt from "jsonwebtoken";
import pool from "../../config/db.config.js";
import authConfig from "../../config/auth.config.js";

// Get categories, no authentication required
export const getCategories = (req, res) => {
  pool.query(
    "SELECT * FROM categories",
    (err, result) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Error al consultar categorías." });
      }
      res.json({
        process: "success",
        message: "Categorías obtenidas exitosamente.",
        count: result.rowCount,
        data: result.rows,
      });
    }
  );
};
