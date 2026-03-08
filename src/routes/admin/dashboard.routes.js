import express from 'express';
const router = express.Router();
import { getTotalActiveUsers, getTotalReferralServiceRequests, getTotalPaidReferralCommissions, getTotalPendingReferralServiceRequests, getTotalServiceRequestsByMonth, getTotalPaidCommissionsByMonth, getTotalUsersByRole } from '../../controllers/admin/dashboard.controller.js';

router.get('/total-active-users', getTotalActiveUsers);
router.get('/total-service-requests', getTotalReferralServiceRequests);
router.get('/total-paid-commissions', getTotalPaidReferralCommissions);
router.get('/total-pending-service-requests', getTotalPendingReferralServiceRequests);
router.get('/total-service-requests-by-month', getTotalServiceRequestsByMonth);
router.get('/total-paid-commissions-by-month', getTotalPaidCommissionsByMonth);
router.get('/total-users-by-role', getTotalUsersByRole);

export default router;