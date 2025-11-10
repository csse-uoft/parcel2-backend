import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { TMP_FILES_DIR, TMP_IMAGES_DIR, ensureTmpDirs } from './storage';

ensureTmpDirs();

function uniqueName(original: string) {
    const ext = path.extname(original);
    const base = path.basename(original, ext).replace(/\s+/g, '_');
    return `${Date.now()}_${randomUUID()}_${base}${ext}`;
}

export const uploadImage = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, TMP_IMAGES_DIR),
        filename: (_req, file, cb) => cb(null, uniqueName(file.originalname)),
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) return cb(null, true);
        cb(new Error('Only image files are allowed'));
    }
});

const ALLOWED_FILE = new Set([
    // document types
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',

    // presentation types
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    // rich text format
    'application/rtf',

    // All MS Office MIME types
    'application/vnd.ms-office',
    'application/vnd.ms-word.document.macroEnabled.12',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
    'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
    

    // compressed files
    'application/zip',
    'application/x-rar-compressed',

    // audio files
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',

    // allow all image types
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff',
]);

export const uploadFile = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, TMP_FILES_DIR),
        filename: (_req, file, cb) => cb(null, uniqueName(file.originalname)),
    }),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_FILE.has(file.mimetype)) return cb(null, true);
        cb(new Error('File type not allowed'));
    }
});
