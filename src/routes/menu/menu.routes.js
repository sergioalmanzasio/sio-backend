import express from 'express';
const router = express.Router();
import { getOptionMenuByRoleId } from '../../controllers/menu/menu.controller.js';

router.get('/options/:role_id', getOptionMenuByRoleId);

export default router;
