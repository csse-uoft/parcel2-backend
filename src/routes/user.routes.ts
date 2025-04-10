import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getUserProfile } from "../controllers/user.controller";

const router = express.Router();

router.get("/profile", authenticate, getUserProfile);

export default router;
