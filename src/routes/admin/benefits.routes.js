import express from 'express';
const router = express.Router();
import { createBenefit, updateBenefit, getBenefitById, getAllBenefits } from '../../controllers/admin/benefits.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

router.post("/", authMiddleware, createBenefit);
router.put("/:token", authMiddleware, updateBenefit);
router.get("/:token", authMiddleware, getBenefitById);
router.get("/", authMiddleware, getAllBenefits);

export default router;