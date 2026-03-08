import express from 'express';
const router = express.Router();
import {
 addServiceRequest, validatePendingRequest, getServiceRequestByClient, getServiceRequestDetails,
 cancelServiceRequestByClient, getServiceRequestByServiceCoordinator, addReferralServiceRequest,
 getReferralServiceRequestsByUser, addCommentToServiceRequest, updateStateAndAddCommentToServiceRequest,
 getCommentsAndUserByServiceRequestID, updateOnlyFillingNumberByTrackingCode
} from '../../controllers/request/request.controller.js';

router.post('/add', addServiceRequest);
router.post('/validate-pending-request', validatePendingRequest);
router.post('/client', getServiceRequestByClient);
router.post('/details', getServiceRequestDetails);
router.post('/cancel-by-client', cancelServiceRequestByClient);
router.post('/service-coordinator', getServiceRequestByServiceCoordinator);
router.post('/add-referral-service-request', addReferralServiceRequest);
router.get('/referral-service-requests', getReferralServiceRequestsByUser);
router.post('/add-comment', addCommentToServiceRequest);
router.post('/update-service-request-state', updateStateAndAddCommentToServiceRequest);
router.post('/get-comments', getCommentsAndUserByServiceRequestID);
router.put('/only-filling-number', updateOnlyFillingNumberByTrackingCode);

export default router;
