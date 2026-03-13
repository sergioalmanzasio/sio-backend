import express from 'express';
const router = express.Router();
import { createBonus, updateBonus, getActiveBonus, getBonusHistory, getBonusesRequestedPayment, paidBonuses } from '../../controllers/admin/bonus.controller.js';

router.post('/', createBonus);
router.put('/:id', updateBonus);
router.get('/active', getActiveBonus);
router.get('/history', getBonusHistory);
router.get('/requested-payment', getBonusesRequestedPayment);
router.post('/paid', paidBonuses);

export default router;
