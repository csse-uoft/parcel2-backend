import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
    getUserOrg,
    getUserProfile,
    initUserProfile,
    updateUserOrg,
    updateUserProfile,
    changeUserPassword
} from "../controllers/user.controller";

const router = express.Router();

router.get("/profile", authenticate, getUserProfile);
router.post("/profile/init", authenticate, initUserProfile);
router.post("/profile", authenticate, updateUserProfile);
router.get("/profile/org", authenticate, getUserOrg);
router.post("/profile/org", authenticate, updateUserOrg);
router.post("/profile/password", authenticate, changeUserPassword);

export default router;
