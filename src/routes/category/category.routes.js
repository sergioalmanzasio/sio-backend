import express from 'express';
const router = express.Router();
import { getCategories } from '../../controllers/category/category.controller.js';

router.get('/all', getCategories); 

export default router;


