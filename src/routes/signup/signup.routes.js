import express from 'express';
const router = express.Router();
import { signUp, signUpGenerateCode, signUpVerifyCode } from '../../controllers/signup/signup.controller.js';

router.post('/', signUp);
router.post('/generate-code', signUpGenerateCode);
router.post('/verify-code', signUpVerifyCode);

export default router;
