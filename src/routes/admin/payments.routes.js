import express from 'express';
const router = express.Router();
import { getPaymentsRequeriments, updatePaymentStatus, getPaidCommissions } from '../../controllers/admin/payments.controller.js';

router.get('/requeriments', getPaymentsRequeriments);
router.post('/paid-commission', updatePaymentStatus);
router.get('/detailed-paid-commissions', getPaidCommissions);

export default router;
