import { Router } from 'express';
import { uploadMiddleware } from '../../middlewares/uploadMiddleware.js';
import { uploadImage, deleteImage } from '../../controllers/admin/uploadController.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

const router = Router();

// El middleware corre primero, luego el controlador
router.post('/', authMiddleware, uploadMiddleware.single('image'), uploadImage);
router.delete('/', authMiddleware, deleteImage);

export default router;