import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model";

export const hashPassword = async (password: string) => {
    return await bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, hash: string) => {
    return await bcrypt.compare(password, hash);
};

export const generateToken = (userId: string, username: string) => {
    return jwt.sign({ userId, username }, process.env.JWT_SECRET as string, { expiresIn: "7d" });
};

