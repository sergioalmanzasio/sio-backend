import express from 'express';
const router = express.Router();
import { signUp, signUpGenerateCode, signUpVerifyCode, registerInternalUser, registerInternalUserWithoutToken, signUpResendCode } from '../../controllers/signup/signup.controller.js';

router.post('/', signUp);
router.post('/generate-code', signUpGenerateCode);
router.post('/verify-code', signUpVerifyCode);
router.post('/register-internal-user', registerInternalUser);
router.post('/register-internal-user-without-token', registerInternalUserWithoutToken);
router.post('/resend-code', signUpResendCode);

export default router;
