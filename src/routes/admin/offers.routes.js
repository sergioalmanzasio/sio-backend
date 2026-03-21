import express from 'express';
const router = express.Router();
import { createOffer, updateOffer, getOffers, addBenefitsToOfferEndpoint, getAllBenefits, getAllCategories, getOfferCommissionConfig, updateOfferCommissionConfig } from '../../controllers/admin/offers.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

router.post('/add', authMiddleware, createOffer);
router.put('/update/:id', authMiddleware, updateOffer);
router.get('/get-all', authMiddleware, getOffers);
router.post('/add-benefits/:id', authMiddleware, addBenefitsToOfferEndpoint);
router.get('/get-all-benefits', authMiddleware, getAllBenefits);
router.get('/get-all-categories', authMiddleware, getAllCategories);
router.post('/commission-config', authMiddleware, getOfferCommissionConfig);
router.put('/commission-config', authMiddleware, updateOfferCommissionConfig);

export default router;
