import { Router } from 'express';
import { uploadMiddleware } from '../../middlewares/uploadMiddleware.js';
import { uploadImage, deleteImage } from '../../controllers/admin/uploadController.js';

const router = Router();

// El middleware corre primero, luego el controlador
router.post('/', uploadMiddleware.single('image'), uploadImage);
router.delete('/', deleteImage);

export default router;