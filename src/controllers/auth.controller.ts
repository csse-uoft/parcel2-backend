import {Request, Response} from "express";
import User from "../models/user.model";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import {body, validationResult} from "express-validator";
import {createUser} from "../services/user.service";
import {ServiceError} from "../utils/errors";

const JWT_SECRET = process.env.JWT_SECRET || "jwtsecret_placeholder";

export const validateLogin = [
    body("username").notEmpty().withMessage("Username is required"),
    body("password").notEmpty().withMessage("Password is required"),
];

export const login = async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({errors: errors.array()});
        return;
    }

    const {username, password} = req.body;

    try {
        const user = await User.findOne({ username });
        if (!user) {
            res.status(400).json({ message: "Invalid credentials" });
            return;
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            res.status(400).json({ message: "Invalid credentials" });
            return;
        }

        // Save the last login time
        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign({ userId: user._id, username }, JWT_SECRET, { expiresIn: "7d" });

        res.cookie("token", token, { httpOnly: true });
        res.json({ message: "Login successful", token });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

export const validateRegistration = [
    body("username").notEmpty().withMessage("Username is required"),
    body("password").isLength({min: 6}).withMessage("Password must be at least 6 characters"),
    body("email").isEmail().withMessage("Invalid email address"),
];


export const register = async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({errors: errors.array()});
        return;
    }

    const {username, password, email} = req.body;

    try {
        const user = await createUser({username, password, email});
        res.status(201).json({message: "User registered successfully"});
    } catch (err) {
        if (err instanceof ServiceError) {
            res.status(400).json({message: err.message});
        } else {
            res.status(500).json({message: "Server error"});
        }
    }
}

export async function logout(req: Request, res: Response) {
    res.clearCookie("token");
    res.json({ message: "Logged out successfully" });
}