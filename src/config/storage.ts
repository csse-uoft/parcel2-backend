import path from 'path';
import fs from 'fs';
import { execFile } from 'node:child_process';
import { scheduleCleanupTmp } from "../jobs/cleanupTmp";

export const PUBLIC_DIR = path.join(process.cwd(), 'public');  // served statically
export const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
export const TMP_DIR = path.join(UPLOADS_DIR, 'tmp');          // /uploads/tmp/*
export const OPPS_DIR = path.join(UPLOADS_DIR, 'opportunities'); // /uploads/opportunities/*

function ensureDir(p: string) {
    fs.mkdirSync(p, { recursive: true });
}


export const TMP_IMAGES_DIR = path.join(TMP_DIR, 'images');
export const TMP_FILES_DIR = path.join(TMP_DIR, 'files');

export function ensureTmpDirs() {
    [PUBLIC_DIR, UPLOADS_DIR, TMP_DIR, OPPS_DIR].forEach(ensureDir);

    ensureDir(TMP_IMAGES_DIR);
    ensureDir(TMP_FILES_DIR);
}

export function initCleanupJob() {
    scheduleCleanupTmp(
        24 * 60 * 60 * 1000, // every 24 hours
        { hours: 24, dryRun: false, verbose: false },
        (r) => console.log(`cleanupTmp: removed ${r.filesRemoved} file(s), freed ${r.bytesFreed} bytes`),
        (e) => console.error('cleanupTmp error:', e)
    );
}