import { Request, Response } from "express";
import User from "../models/user.model";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import { createUser } from "../services/user.service";
import { ServiceError } from "../utils/errors";
import { getAuthTokenDecoded } from "../services/auth.service";

const JWT_SECRET = process.env.JWT_SECRET || "jwtsecret_placeholder";

export const validateLogin = [
    body("username").notEmpty().withMessage("Username is required"),
    body("password").notEmpty().withMessage("Password is required"),
];

const isEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

export const login = async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }

    const { username, password } = req.body;

    let user;

    try {
        // Check if the username is an email or username
        if (isEmail(username)) {
            user = await User.findOne({ email: username });
        } else {
            user = await User.findOne({ username });
        }

        if (!user) {
            res.status(400).json({errors: [{ msg: "Invalid username", path: "username" }]});
            return;
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            res.status(400).json({errors: [{ msg: "Invalid username or credentials", path: "password" }]});
            return;
        }

        // Save the last login time
        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });

        res.cookie("token", token, { httpOnly: true, sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", secure: process.env.NODE_ENV === "production" });
        res.json({ message: "Login successful", token });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

export const validateRegistration = [
    body("username")
        .notEmpty().withMessage("Username is required")
        // username should be alphanumeric and between 3-20 characters
        .isAlphanumeric().withMessage("Username must be alphanumeric")
        .isLength({ min: 3, max: 20 }).withMessage("Username must be between 3 and 20 characters")
        // username should not be "guest"
        .not().equals("guest").withMessage("Username cannot be 'guest'"),
    body("password")
        // password should contain at least one uppercase letter, one lowercase letter, one number and one special character
        .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
        .isStrongPassword({
            minLength: 8,
            minUppercase: 1,
            minLowercase: 1,
            minNumbers: 1,
            minSymbols: 1,
        }).withMessage("Password must contain at least one uppercase letter, one lowercase letter, one number and one special character"),
    body("email").isEmail().withMessage("Invalid email address"),
];


export const register = async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }

    const { username, password, email } = req.body;

    try {
        const user = await createUser({ username, password, email });
        res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
        if (err instanceof ServiceError) {
            res.status(400).json({ message: err.message });
        } else {
            res.status(500).json({ message: "Server error" });
        }
    }
}

export async function logout(req: Request, res: Response) {
    res.clearCookie("token");
    res.json({ message: "Logged out successfully" });
}

export async function getCurrentUser(req: Request, res: Response): Promise<void> {
    const token = getAuthTokenDecoded(req);
    if (!token) {
        res.status(200).json({ username: "guest" });
        return;
    } else {
        const user = await User.findById(token.userId).select("-password");
        if (!user) {
            // Should not happen if token is valid
            res.clearCookie("token");
            res.status(200).json({ username: "guest" });
            return
        }
        // exp is the time left in seconds of the token
        res.status(200).json({...user.toJSON(), exp: (token.exp! - Math.floor(Date.now() / 1000))});
        return;
    }
}
