import express from "express";
import {login, logout, register, validateLogin, validateRegistration} from "../controllers/auth.controller";
import {loginLimiter, registerLimiter} from "../middleware/rateLimit.middleware";

const router = express.Router();

router.post("/login", loginLimiter, validateLogin, login);
router.post("/register", registerLimiter, validateRegistration, register);
router.post("/logout", logout);

export default router;
