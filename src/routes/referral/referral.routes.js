import express from 'express';
const router = express.Router();

import {
 createReferredExistCustomer, getReferredClients, getReferredClientsByToCoordinatorServices, getGeneralInformationOfReferralRequestService, calculateCommission, requestPaymentCommission, getCommissionAvailable, getTotalCommision, getCommissionsHistory
} from '../../controllers/referral/referral.controller.js';

router.post('/create-referred-exist-customer', createReferredExistCustomer);
router.post('/my-referrals', getReferredClients);
router.post('/by-coordinator-services', getReferredClientsByToCoordinatorServices);
router.post('/general-information', getGeneralInformationOfReferralRequestService);
router.post('/calculate-commission', calculateCommission);
router.post('/request-payment-commission', requestPaymentCommission);
router.get('/get-commission-available', getCommissionAvailable);
router.get('/commissions/history/filter', getCommissionsHistory);
router.get('/get-total-commision', getTotalCommision);

export default router;