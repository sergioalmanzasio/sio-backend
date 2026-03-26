import express from 'express';
const router = express.Router();

import { validatePersonExistByDocument, createPersonByReferral, getPersonByEmail, updatePersonalInfo, updateBankInfo, updateLocationInfo, createPerson, createPersonByReferralCode } from '../../controllers/person/person.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';


router.post('/create-person-by-referral', createPersonByReferral);
router.post('/create-person-by-referral-code', createPersonByReferralCode);
router.post('/create-person', createPerson);
router.post('/validate-exist-by-document', validatePersonExistByDocument);
router.post('/info', authMiddleware, getPersonByEmail);
router.put('/info', authMiddleware, updatePersonalInfo);
router.put('/bank-info', authMiddleware, updateBankInfo);
router.put('/location-info', authMiddleware, updateLocationInfo);

export default router;
