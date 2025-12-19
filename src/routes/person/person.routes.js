import express from 'express';
const router = express.Router();

import { validatePersonExistByDocument, createPersonByReferral } from '../../controllers/person/person.controller.js';


router.post('/create-person-by-referral', createPersonByReferral);
router.post('/validate-exist-by-document', validatePersonExistByDocument);

export default router;
