import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model";
import { Request } from "express";
import crypto from "node:crypto";

export interface AuthToken {
    userId: string;
    username: string;
    exp?: number;
}

export function getAuthTokenDecoded(req: Request): AuthToken | null {
    if (req.cookies.token) {
        return decodeToken(req.cookies.token);
    } else if (req.headers.authorization) {
        const token = req.headers.authorization.split(" ")[1];
        return decodeToken(token);
    } else {
        return null;
    }
}

export function decodeToken(token: string): AuthToken | null {
    try {
        return jwt.verify(token, process.env.JWT_SECRET as string) as AuthToken;
    } catch (error) {
        console.error("Token verification error:", error);
        return null;
    }
}

export const hashPassword = async (password: string) => {
    return await bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, hash: string) => {
    return await bcrypt.compare(password, hash);
};

export const generateToken = (data: AuthToken) => {
    return jwt.sign({ userId: data.userId, username: data.username }, process.env.JWT_SECRET as string, { expiresIn: "7d" });
};

export const generatePassword = (
    length = 20,
    characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz,./?~!@-#$'
) =>
    Array.from(crypto.randomFillSync(new Uint32Array(length)))
        .map((x) => characters[x % characters.length])
        .join('')