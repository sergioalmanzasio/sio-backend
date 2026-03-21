import express from 'express';
const router = express.Router();

import {
 createReferredExistCustomer, getReferredClients, getReferredClientsByToCoordinatorServices, getGeneralInformationOfReferralRequestService, calculateCommission, requestPaymentCommission, getCommissionAvailable, getTotalCommision, getCommissionsHistory, getReferralBonusesGenerated, requestPaymentBonus, getBonusesHistory
} from '../../controllers/referral/referral.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

router.post('/create-referred-exist-customer', authMiddleware, createReferredExistCustomer);
router.post('/my-referrals', authMiddleware, getReferredClients);
router.post('/by-coordinator-services', authMiddleware, getReferredClientsByToCoordinatorServices);
router.post('/general-information', authMiddleware, getGeneralInformationOfReferralRequestService);
router.post('/calculate-commission', authMiddleware, calculateCommission);
router.post('/request-payment-commission', authMiddleware, requestPaymentCommission);
router.get('/get-commission-available', authMiddleware, getCommissionAvailable);
router.get('/commissions/history/filter', authMiddleware, getCommissionsHistory);
router.get('/get-total-commision', authMiddleware, getTotalCommision);
router.get('/get-bonus-generated', authMiddleware, getReferralBonusesGenerated);
router.post('/request-payment-bonus', authMiddleware, requestPaymentBonus);
router.get('/bonuses/history/filter', authMiddleware, getBonusesHistory);

export default router;