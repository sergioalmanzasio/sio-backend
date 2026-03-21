import jwt from "jsonwebtoken";

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];
  if (!token || token === "null" || token === "undefined" || token.trim() === "") {
    return res.status(401).json({
      process: "session-expired",
      message: "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad (CC-010)."
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.token = token;
    next();

  } catch (error) {
    return res.status(401).json({
      process: "session-expired",
      message: "No pudimos validar tu sesión. Accede nuevamente a SIO para continuar con seguridad (CC-010)."
    });
  }
};