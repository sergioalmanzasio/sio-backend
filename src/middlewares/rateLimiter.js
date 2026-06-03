import { rateLimit } from 'express-rate-limit';

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,

  handler: (req, res) => {
    console.warn(`[SECURITY_ALERT] Fuerza bruta detectada desde la IP: ${req.ip}`);

    return res.status(429).json({
      error: 'TooManyRequests',
      message: 'Demasiados intentos de inicio de sesión. Por favor, inténtalo de nuevo en 15 minutos.'
    });
  },

  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
