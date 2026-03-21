import express from 'express';
const router = express.Router();
import { createOperator, updateOperator, getOperatorById, getAllOperators } from '../../controllers/admin/operators.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

router.post("/", authMiddleware, createOperator);
router.get("/:token", authMiddleware, getOperatorById);
router.put("/:token", authMiddleware, updateOperator);
router.get("/", authMiddleware, getAllOperators);

export default router;
