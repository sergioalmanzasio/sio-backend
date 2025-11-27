import express from 'express';
const router = express.Router();
import { addServiceRequest, validatePendingRequest, getServiceRequestByClient, getServiceRequestDetails, 
 cancelServiceRequestByClient, getServiceRequestByServiceCoordinator } from '../../controllers/request/request.controller.js';

router.post('/add', addServiceRequest);
router.post('/validate-pending-request', validatePendingRequest);
router.post('/client', getServiceRequestByClient);
router.post('/details', getServiceRequestDetails);
router.post('/cancel-by-client', cancelServiceRequestByClient);
router.post('/service-coordinator', getServiceRequestByServiceCoordinator);

export default router;
