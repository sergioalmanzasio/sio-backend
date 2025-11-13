import jwt from "jsonwebtoken";
import authConfig from "../config/auth.config.js";

const verifyToken = (req, res, next) => {
  const token = req.cookies.token; // viene de cookie-parser

  if (!token) {
    return res.status(403).send({ message: "No se proporcionó un token." });
  }

  jwt.verify(token, authConfig.secret, (err, decoded) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).send({ message: "Sesión expirada, vuelve a iniciar sesión." });
      }
      return res.status(401).send({ message: "Token inválido." });
    }

    req.userId = decoded.user_id;
    req.userRole = decoded.role_id;
    next();
  });
};

export default verifyToken;