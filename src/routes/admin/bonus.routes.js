import express from 'express';
const router = express.Router();
import { createBonus, updateBonus, getActiveBonus, getBonusHistory, getBonusesRequestedPayment, paidBonuses } from '../../controllers/admin/bonus.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

router.post('/', authMiddleware, createBonus);
router.put('/:id', authMiddleware, updateBonus);
router.get('/active', authMiddleware, getActiveBonus);
router.get('/history', authMiddleware, getBonusHistory);
router.get('/requested-payment', authMiddleware, getBonusesRequestedPayment);
router.post('/paid', authMiddleware, paidBonuses);

export default router;
