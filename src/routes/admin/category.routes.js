import express from 'express';
const router = express.Router();
import { createCategory, updateCategory, getCategoryByToken, getAllCategories } from '../../controllers/admin/category.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

router.post("/", authMiddleware, createCategory);
router.get("/:token", authMiddleware, getCategoryByToken);
router.put("/:categoryToken", authMiddleware, updateCategory);
router.get("/", authMiddleware, getAllCategories);

export default router;