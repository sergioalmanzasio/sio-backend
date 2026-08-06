import express from 'express';
const router = express.Router();
import { getUsersAndRoles, updateUserStatus } from '../../controllers/admin/users.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

router.get('/', authMiddleware, getUsersAndRoles);
router.put('/status', authMiddleware, updateUserStatus);

export default router;
