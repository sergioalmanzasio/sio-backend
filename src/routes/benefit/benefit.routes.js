import express from 'express';
const router = express.Router();
import { getBenefitsByOfferId } from '../../controllers/benefit/benefit.controller.js';

router.get('/all-by-offer/:offer_id', getBenefitsByOfferId);

export default router;
