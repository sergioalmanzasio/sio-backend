import express from 'express';
const router = express.Router();
import { addServiceRequest, validatePendingRequest } from '../../controllers/request/request.controller.js';

router.post('/add', addServiceRequest);
router.post('/validate-pending-request', validatePendingRequest);

export default router;
