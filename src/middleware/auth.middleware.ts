import { Request, Response, NextFunction } from "express";
import { getAuthTokenDecoded } from "../services/auth.service";
import User from "../models/user.model";
import { normalizeRoles, UserRole } from "../constants/roles";

export interface RequestUser {
    id: string;
    username: string;
    roles: UserRole[];
    organizationIRI?: string | null;
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = getAuthTokenDecoded(req);
    if (!token) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const userDoc = await User.findById(token.userId);
    if (!userDoc) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const roles = normalizeRoles((userDoc.roles as UserRole[]) ?? undefined);
    const requestUser: RequestUser = {
        id: userDoc._id.toString(),
        username: userDoc.username,
        roles,
        organizationIRI: userDoc.organizationIRI,
    };
    (req as any).user = requestUser;
    (req as any).currentUser = userDoc;
    next();
};
