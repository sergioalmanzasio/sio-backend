import multer from 'multer';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB es suficiente para logos

const fileFilter = (req, file, cb) => {
 if (ALLOWED_TYPES.includes(file.mimetype)) {
  cb(null, true);
 } else {
  cb(new Error(`Tipo no permitido. Solo: ${ALLOWED_TYPES.join(', ')}`), false);
 }
};

export const uploadMiddleware = multer({
 storage: multer.memoryStorage(),
 limits: { fileSize: MAX_SIZE },
 fileFilter,
});