import express from 'express';
const router = express.Router();

import { validatePersonExistByDocument, createPersonByReferral, getPersonByEmail, updatePersonalInfo, updateBankInfo, updateLocationInfo, createPerson } from '../../controllers/person/person.controller.js';


router.post('/create-person-by-referral', createPersonByReferral);
router.post('/create-person', createPerson);
router.post('/validate-exist-by-document', validatePersonExistByDocument);
router.post('/info', getPersonByEmail);
router.put('/info', updatePersonalInfo);
router.put('/bank-info', updateBankInfo);
router.put('/location-info', updateLocationInfo);

export default router;
