import { Request, Response } from "express";
import User from "../models/user.model";

export const getUserProfile = async (req: Request, res: Response) => {
    try {
        const user = await User.findById((req as any).user.userId).select("-password");
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "Error fetching user profile" });
    }
};
