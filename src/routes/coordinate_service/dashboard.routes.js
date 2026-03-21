import express from 'express';
const router = express.Router();

import { getServiceRequestCountByState, getServiceRequestCountByMonth } from '../../controllers/coordinate_service/dashboard.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

router.get('/service-requests/count', authMiddleware, getServiceRequestCountByState);
router.get('/service-requests/count-by-month', authMiddleware, getServiceRequestCountByMonth);

export default router;
