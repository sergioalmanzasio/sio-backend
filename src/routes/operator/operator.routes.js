import express from 'express';
const router = express.Router();
import { getOperators } from '../../controllers/operator/operator.controller.js';

router.get('/all', getOperators);

export default router;
