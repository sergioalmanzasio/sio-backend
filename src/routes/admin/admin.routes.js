import express from 'express';
const router = express.Router();
import { getAllServiceRequests } from '../../controllers/admin/admin.controller.js';

router.get('/service-requests', getAllServiceRequests);

export default router;