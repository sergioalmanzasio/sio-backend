import express from 'express';
const router = express.Router();
import { getTotalActiveUsers, getTotalReferralServiceRequests, getTotalPaidReferralCommissions, getTotalPendingReferralServiceRequests, getTotalServiceRequestsByMonth, getTotalPaidCommissionsByMonth, getTotalUsersByRole } from '../../controllers/admin/dashboard.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

router.get('/total-active-users', authMiddleware, getTotalActiveUsers);
router.get('/total-service-requests', authMiddleware, getTotalReferralServiceRequests);
router.get('/total-paid-commissions', authMiddleware, getTotalPaidReferralCommissions);
router.get('/total-pending-service-requests', authMiddleware, getTotalPendingReferralServiceRequests);
router.get('/total-service-requests-by-month', authMiddleware, getTotalServiceRequestsByMonth);
router.get('/total-paid-commissions-by-month', authMiddleware, getTotalPaidCommissionsByMonth);
router.get('/total-users-by-role', authMiddleware, getTotalUsersByRole);

export default router;