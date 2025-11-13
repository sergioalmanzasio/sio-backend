import express from 'express';
const router = express.Router();
import { 
 insertDocumentType, 
 getAllDocumentTypes, 
 getDocumentTypeById, 
 updateDocumentType, 
 inactivateActivateDocumentType 
} from '../../controllers/document_type/document_type.controller.js';

router.post('/insert', insertDocumentType);
router.get('/all', getAllDocumentTypes);
router.get('/get/:id', getDocumentTypeById);
router.put('/update/:id', updateDocumentType);
router.put('/inactivate-activate/:id', inactivateActivateDocumentType);

export default router;
