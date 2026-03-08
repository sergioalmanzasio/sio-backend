import express from 'express';
const router = express.Router();

import { getServiceRequestCountByState, getServiceRequestCountByMonth } from '../../controllers/coordinate_service/dashboard.controller.js';

router.get('/service-requests/count', getServiceRequestCountByState);
router.get('/service-requests/count-by-month', getServiceRequestCountByMonth);

export default router;
