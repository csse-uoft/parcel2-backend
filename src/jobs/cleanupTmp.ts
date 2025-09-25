import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import { TMP_DIR } from '../config/storage';

export interface CleanupTmpOptions {
    /** Root directory to scan; defaults to your configured TMP_DIR */
    root?: string;
    /** Delete files older than this many hours (default: 24) */
    hours?: number;
    /** If true, only log what would be removed */
    dryRun?: boolean;
    /** If true, logs details via `logger` */
    verbose?: boolean;
    /** Follow symlinks; default false */
    followSymlinks?: boolean;
    /** Custom logger (defaults to console.log when verbose) */
    logger?: (msg: string) => void;
}

export interface CleanupTmpResult {
    scannedRoot: string;
    filesRemoved: number;
    dirsRemoved: number;
    bytesFreed: number;
    durationMs: number;
}

export const DEFAULT_CLEANUP_OPTIONS: Required<Omit<CleanupTmpOptions, 'logger'>> = {
    root: TMP_DIR,
    hours: 24,
    dryRun: false,
    verbose: false,
    followSymlinks: false,
};

function logIf(opts: CleanupTmpOptions, msg: string) {
    if (opts.verbose) {
        (opts.logger ?? console.log)(msg);
    }
}

async function exists(p: string) {
    try { await fs.access(p); return true; } catch { return false; }
}

async function rmFile(p: string, dryRun: boolean) {
    if (!dryRun) await fs.unlink(p).catch(() => {});
}

async function rmDirIfEmpty(dir: string, dryRun: boolean) {
    try {
        const items = await fs.readdir(dir);
        if (items.length === 0) {
            if (!dryRun) await fs.rmdir(dir).catch(() => {});
            return true;
        }
    } catch {}
    return false;
}

export async function cleanupTmp(options: CleanupTmpOptions = {}): Promise<CleanupTmpResult> {
    const opts: Required<Omit<CleanupTmpOptions, 'logger'>> & { logger?: (msg: string) => void } = {
        ...DEFAULT_CLEANUP_OPTIONS,
        ...options,
    };

    const root = opts.root;
    const cutoffMs = Date.now() - opts.hours * 60 * 60 * 1000;

    if (!(await exists(root))) {
        logIf(opts, `cleanupTmp: root does not exist: ${root}`);
        return {
            scannedRoot: root,
            filesRemoved: 0,
            dirsRemoved: 0,
            bytesFreed: 0,
            durationMs: 0,
        };
    }

    const t0 = Date.now();
    let filesRemoved = 0;
    let dirsRemoved = 0;
    let bytesFreed = 0;

    async function visit(current: string) {
        let entries: fssync.Dirent[];
        try {
            entries = await fs.readdir(current, { withFileTypes: true });
        } catch {
            return;
        }

        for (const ent of entries) {
            const full = path.join(current, ent.name);

            if (ent.isDirectory()) {
                await visit(full);
                const removed = await rmDirIfEmpty(full, opts.dryRun);
                if (removed) {
                    dirsRemoved++;
                    logIf(opts, `cleanupTmp: removed empty dir ${path.relative(root, full)}`);
                }
                continue;
            }

            if (ent.isSymbolicLink() && !opts.followSymlinks) continue;
            if (!ent.isFile() && !ent.isSymbolicLink()) continue;

            try {
                const stat = await fs.stat(full); // follows symlink metadata
                const mtime = stat.mtimeMs ?? stat.ctimeMs ?? 0;
                if (mtime < cutoffMs) {
                    logIf(opts, `cleanupTmp: delete ${path.relative(root, full)} (${stat.size} bytes)`);
                    await rmFile(full, opts.dryRun);
                    filesRemoved++;
                    bytesFreed += stat.size;
                }
            } catch {
                // ignore unreadable files
            }
        }
    }

    await visit(root);
    // Try pruning the top-level directory if it became empty (not critical if it fails)
    await rmDirIfEmpty(root, opts.dryRun);

    const durationMs = Date.now() - t0;
    return { scannedRoot: root, filesRemoved, dirsRemoved, bytesFreed, durationMs };
}

/**
 * Convenience helper to schedule periodic cleanup.
 * Returns a cancel function.
 */
export function scheduleCleanupTmp(
    intervalMs: number,
    options?: CleanupTmpOptions,
    onFinish?: (result: CleanupTmpResult) => void,
    onError?: (err: unknown) => void,
): () => void {
    const timer = setInterval(() => {
        cleanupTmp(options)
            .then((res) => onFinish?.(res))
            .catch((err) => onError?.(err));
    }, intervalMs);

    // Run once immediately if desired:
    // cleanupTmp(options).then(onFinish).catch(onError);

    return () => clearInterval(timer);
}

if (require.main === module) {
    // If run directly, do a one-off cleanup with default options
    cleanupTmp({ verbose: true })
        .then((res) => {
            console.log(`cleanupTmp: done. Removed ${res.filesRemoved} files, `
                + `${res.dirsRemoved} dirs, freed ${res.bytesFreed} bytes in `
                + `${res.durationMs} ms`);
            process.exit(0);
        })
        .catch((err) => {
            console.error('cleanupTmp: error:', err);
            process.exit(1);
        });
}