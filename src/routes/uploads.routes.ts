import { Router } from 'express';
import { uploadImage, uploadFile } from '../config/multer';
import { handleUploadFile, handleUploadImage } from "../controllers/uploads.controller";

const router = Router();

/**
 * POST /api/uploads/images
 * field name: "file" (single file per request)
 * returns: { url: "/uploads/tmp/images/<filename>" }
 */
router.post('/images', uploadImage.single('file'), handleUploadImage);

/**
 * POST /api/uploads/files
 * field name: "file" (single file per request)
 * returns: { url: "/uploads/tmp/files/<filename>" }
 */
router.post('/files', uploadFile.single('file'), handleUploadFile);

export default router;
