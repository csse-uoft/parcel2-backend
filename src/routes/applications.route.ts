import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getMyApplication, listMyApplications } from "../controllers/call-for-proposals.controller";

const router = Router();

router.get("/", authenticate, listMyApplications);
router.get("/:applicationIri", authenticate, getMyApplication);

export default router;
