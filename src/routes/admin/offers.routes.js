import express from 'express';
const router = express.Router();
import { createOffer, updateOffer, getOffers, addBenefitsToOfferEndpoint, getAllBenefits, getAllCategories } from '../../controllers/admin/offers.controller.js';

router.post('/add', createOffer);
router.put('/update/:id', updateOffer);
router.get('/get-all', getOffers);
router.post('/add-benefits/:id', addBenefitsToOfferEndpoint);
router.get('/get-all-benefits', getAllBenefits);
router.get('/get-all-categories', getAllCategories);

export default router;
