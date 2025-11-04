import { Router } from 'express';
import { cleanupTmp } from '../jobs/cleanupTmp';
import { authenticate } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/roles.middleware";
import {
    assignUserOrganization,
    deleteOrganization,
    listOrganizations,
    listUsers,
    resetUserPassword,
    updateUserRoles,
    updateOrganization,
} from "../controllers/admin.controller";

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/users', listUsers);
router.get('/organizations', listOrganizations);
router.patch('/organizations/:organizationIri', updateOrganization);
router.delete('/organizations/:organizationIri', deleteOrganization);
router.post('/users/:userId/organization', assignUserOrganization);
router.post('/users/:userId/reset-password', resetUserPassword);
router.post('/users/:userId/roles', updateUserRoles);

router.post('/cleanup-tmp', async (req, res) => {
    const { hours = 24, dryRun = false, verbose = true } = req.body ?? {};
    const result = await cleanupTmp({ hours, dryRun, verbose });
    res.json(result);
});

export default router;
