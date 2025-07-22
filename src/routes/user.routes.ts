import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
    getUserOrg,
    getUserProfile,
    initUserProfile,
    updateUserOrg,
    updateUserProfile
} from "../controllers/user.controller";

const router = express.Router();

router.get("/profile", authenticate, getUserProfile);
router.post("/profile/init", authenticate, initUserProfile);
router.post("/profile", authenticate, updateUserProfile);
router.get("/profile/org", authenticate, getUserOrg);
router.post("/profile/org", authenticate, updateUserOrg);

export default router;
