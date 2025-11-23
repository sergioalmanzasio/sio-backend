import express from 'express';
const router = express.Router();
import { 
 getOffersRestricted, 
 getOffers, 
 getOfferByOperatorIdRestricted, 
 getOfferByOperatorId, 
 getOfferByCategoryIdRestricted, 
 getOfferByServiceId, 
 getOfferByOperatorIdAndServiceId 
} from '../../controllers/offer/offer.controller.js';

router.get('/all-restricted', getOffersRestricted);
router.get('/all', getOffers);
router.get('/operator-restricted/:operator_id', getOfferByOperatorIdRestricted);
router.get('/operator/:operator_id', getOfferByOperatorId);
router.get('/category-restricted/:category_id', getOfferByCategoryIdRestricted);
router.get('/service/:service_id', getOfferByServiceId);
router.get('/operator-service/:operator_id/:service_id', getOfferByOperatorIdAndServiceId);

export default router;
