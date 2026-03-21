import express from 'express';
const router = express.Router();
import { getPaymentsRequeriments, updatePaymentStatus, getPaidCommissions, getPaidBonuses } from '../../controllers/admin/payments.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

router.get('/requeriments', authMiddleware, getPaymentsRequeriments);
router.post('/paid-commission', authMiddleware, updatePaymentStatus);
router.get('/detailed-paid-commissions', authMiddleware, getPaidCommissions);
router.get('/detailed-paid-bonuses', authMiddleware, getPaidBonuses);

export default router;
