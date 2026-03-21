import express from 'express';
const router = express.Router();
import { getAllServiceRequests } from '../../controllers/admin/admin.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

router.get('/service-requests', authMiddleware, getAllServiceRequests);

export default router;