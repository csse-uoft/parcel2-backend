import { Request, Response, NextFunction } from "express";
import { AuthToken, getAuthTokenDecoded } from "../services/auth.service";

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = getAuthTokenDecoded(req);
    if (!token) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    next();
};
