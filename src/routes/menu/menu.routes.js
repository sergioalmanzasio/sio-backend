import express from 'express';
const router = express.Router();
import { getOptionMenuByRoleId } from '../../controllers/menu/menu.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

router.get('/options/:role_id', authMiddleware, getOptionMenuByRoleId);

export default router;
