import pool from "../../config/db.config.js";
import authConfig from "../../config/auth.config.js";
import jwt from "jsonwebtoken";

// Get option menu by role id
export const getOptionMenuByRoleId = (req, res) => {
  const { role_id } = req.params;
  if (!role_id || role_id === "" || role_id === null || role_id === undefined) {
    return res
      .status(400)
      .json({ message: "Debe proporcionar un ID de rol válido." });
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
      `SELECT op."name", op.url 
              FROM role_options_app roa 
              JOIN roles rl ON roa.role_id = rl.id 
              JOIN options_app op ON op.id = roa.option_id 
              WHERE roa.role_id = $1 AND roa.is_active = TRUE;`,
      [role_id],
      (err, result) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Error al consultar opciones del menu." });
        }
        return res.status(200).json({
          message: "Opciones del menu encontradas.",
          data: result.rows,
          count: result.rowCount,
        });
      }
    );
  });
};
