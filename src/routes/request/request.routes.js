import express from 'express';
const router = express.Router();
import {
 addServiceRequest, validatePendingRequest, getServiceRequestByClient, getServiceRequestDetails,
 cancelServiceRequestByClient, getServiceRequestByServiceCoordinator, addReferralServiceRequest,
 getReferralServiceRequestsByUser, addCommentToServiceRequest, updateStateAndAddCommentToServiceRequest,
 getCommentsAndUserByServiceRequestID, updateOnlyFillingNumberByTrackingCode
} from '../../controllers/request/request.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

router.post('/add', authMiddleware, addServiceRequest);
router.post('/validate-pending-request', authMiddleware, validatePendingRequest);
router.post('/client', authMiddleware, getServiceRequestByClient);
router.post('/details', authMiddleware, getServiceRequestDetails);
router.post('/cancel-by-client', authMiddleware, cancelServiceRequestByClient);
router.post('/service-coordinator', authMiddleware, getServiceRequestByServiceCoordinator);
router.post('/add-referral-service-request', authMiddleware, addReferralServiceRequest);
router.get('/referral-service-requests', authMiddleware, getReferralServiceRequestsByUser);
router.post('/add-comment', authMiddleware, addCommentToServiceRequest);
router.post('/update-service-request-state', authMiddleware, updateStateAndAddCommentToServiceRequest);
router.post('/get-comments', authMiddleware, getCommentsAndUserByServiceRequestID);
router.put('/only-filling-number', authMiddleware, updateOnlyFillingNumberByTrackingCode);

export default router;
