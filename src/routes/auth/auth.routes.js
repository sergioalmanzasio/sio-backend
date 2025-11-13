import express from 'express';
const router = express.Router();
import { signIn, getSessionData, signOut } from '../../controllers/auth/auth.controller.js';

router.post('/sign-in', signIn);
router.get('/session-data', getSessionData);
router.post('/sign-out', signOut);

export default router;
