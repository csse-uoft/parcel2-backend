import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireOrgAdmin } from "../middleware/roles.middleware";
import {
    inviteUserToOrganization,
    listOrganizationUsers,
    resetOrganizationUserPassword,
} from "../controllers/org-admin.controller";

const router = Router();

router.use(authenticate, requireOrgAdmin);

router.get("/users", listOrganizationUsers);
router.post("/users/:userId/reset-password", resetOrganizationUserPassword);
router.post("/users/invite", inviteUserToOrganization);

export default router;
