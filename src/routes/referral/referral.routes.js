import express from 'express';
const router = express.Router();

import { createReferredExistCustomer, getReferredClients, getReferredClientsByToCoordinatorServices } from '../../controllers/referral/referral.controller.js';

router.post('/create-referred-exist-customer', createReferredExistCustomer);
router.post('/my-referrals', getReferredClients);
router.post('/by-coordinator-services', getReferredClientsByToCoordinatorServices);

export default router;
