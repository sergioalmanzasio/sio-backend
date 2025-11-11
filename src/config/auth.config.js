// config/auth.config.js
import dotenv from 'dotenv';
dotenv.config();

export default {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN
};