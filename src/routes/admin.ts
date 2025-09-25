import { Router } from 'express';
import { cleanupTmp } from '../jobs/cleanupTmp';

const router = Router();

router.post('/cleanup-tmp', async (req, res) => {
    const { hours = 24, dryRun = false, verbose = true } = req.body ?? {};
    const result = await cleanupTmp({ hours, dryRun, verbose });
    res.json(result);
});

export default router;
