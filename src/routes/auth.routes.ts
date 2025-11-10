import express from "express";
import {
    extendSession,
    getCurrentUser,
    login,
    logout,
    register,
    requestPasswordReset,
    resetPassword,
    validateLogin,
    validatePasswordReset,
    validatePasswordResetRequest,
    validateRegistration, verifyEmail
} from "../controllers/auth.controller";
import {loginLimiter, passwordResetLimiter, registerLimiter} from "../middleware/rateLimit.middleware";
import passport from "passport";
import { frontendConfig } from "../config/configs";
import jwt from "jsonwebtoken";
import { configs } from "../config/configs";

const router = express.Router();

router.post("/login", loginLimiter, validateLogin, login);
router.post("/register/verify/:token", validateRegistration, verifyEmail);
router.post("/register", registerLimiter, validateRegistration, register);
router.post("/password/forgot", passwordResetLimiter, validatePasswordResetRequest, requestPasswordReset);
router.post("/password/reset", validatePasswordReset, resetPassword);

router.post("/logout", logout);
router.get("/me", getCurrentUser);
router.post("/session/extend", extendSession);

router.get('/google', passport.authenticate('google'));
router.get('/google/callback', passport.authenticate('google', {
    failureRedirect: frontendConfig.address + '/login',
    session: false,
}), (req, res) => {
    // Successful authentication, redirect home.
    if (!req.user) {
        return res.redirect(frontendConfig.address + '/login');
    }

    // Create a JWT token
    // @ts-ignore
    const token = jwt.sign({ userId: req.user._id, username: req.user.username }, configs.JWT_SECRET, { expiresIn: "7d" });

    res.cookie("token", token, { httpOnly: true, sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", secure: process.env.NODE_ENV === "production" });

    res.redirect(frontendConfig.address);
});


export default router;
