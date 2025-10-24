import { NextFunction, Request, Response } from "express";
import { hasRole, UserRole } from "../constants/roles";
import { RequestUser } from "./auth.middleware";

export function requireRoles(...requiredRoles: UserRole[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user as RequestUser | undefined;
        if (!user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        if (!hasRole(user.roles, requiredRoles)) {
            res.status(403).json({ message: "Forbidden" });
            return;
        }
        next();
    };
}

export const requireAdmin = requireRoles(UserRole.ADMIN);

export const requireOrgAdmin = requireRoles(UserRole.ADMIN, UserRole.ORG_ADMIN);
