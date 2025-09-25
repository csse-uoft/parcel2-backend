import path from 'path';
import fs from 'fs/promises';
import fssync from 'fs';
import {
    PUBLIC_DIR, TMP_DIR, OPPS_DIR,
} from '../config/storage';

const TMP_PREFIX = '/uploads/tmp/';
const OPPS_PREFIX = '/uploads/opportunities';

export function isTmpUrl(url: string) {
    return typeof url === 'string' && url.startsWith(TMP_PREFIX);
}

export function diskPathFromUrl(urlPath: string) {
    return path.join(PUBLIC_DIR, urlPath);
}

function prettyName(filename: string) {
    // nicer permanent filenames (drop leading timestamp/uuid)
    return filename.replace(/^\d+_[0-9a-f-]+_/, '');
}

async function ensureDir(dir: string) {
    await fs.mkdir(dir, { recursive: true });
}

/**
 * Move src to dest, ensuring dest is unique by appending -1, -2, etc if needed
 */
async function moveUnique(src: string, dest: string) {
    const { dir, name, ext } = path.parse(dest);
    let candidate = dest, i = 1;
    while (fssync.existsSync(candidate)) {
        candidate = path.join(dir, `${name}-${i}${ext}`);
        i++;
    }
    await fs.rename(src, candidate);
    return candidate;
}

/**
 * Move any tmp URLs to their permanent location, return final list of URLs
 */
export async function finalizeUrlList(opportunityId: string, urls: string[] | undefined) {
    if (!urls?.length) return [];
    // ensure opportunityId is safe to use as a directory name
    if (!/^[a-zA-Z0-9-_]+$/.test(opportunityId)) {
        throw new Error(`Invalid opportunityId '${opportunityId}'`);
    }
    const destDirUrl  = `${OPPS_PREFIX}/${opportunityId}`;
    const destDirDisk = path.join(PUBLIC_DIR, destDirUrl);
    await ensureDir(destDirDisk);

    const out: string[] = [];

    for (const url of urls) {
        if (isTmpUrl(url)) {
            const srcDisk = diskPathFromUrl(url);
            const filename = path.basename(srcDisk);
            const destDisk = path.join(destDirDisk, prettyName(filename));
            if (fssync.existsSync(srcDisk)) {
                const moved = await moveUnique(srcDisk, destDisk);
                const finalUrl = moved.replace(PUBLIC_DIR, '').replace(/\\/g, '/');
                out.push(finalUrl);
            } else {
                // tmp no longer exists → skip
            }
        } else {
            out.push(url);
        }
    }
    return out;
}

export function tmpPublicUrl(kind: 'image'|'file', filename: string) {
    return `/uploads/tmp/${kind === 'image' ? 'images' : 'files'}/${filename}`;
}
