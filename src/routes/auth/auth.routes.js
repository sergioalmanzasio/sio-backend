import express from 'express';
const router = express.Router();
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { signIn, getSessionData, signOut, forgotPassword, resetPassword } from '../../controllers/auth/auth.controller.js';

router.post('/sign-in', signIn);
router.get('/session-data', authMiddleware, getSessionData);
router.post('/sign-out', signOut);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
