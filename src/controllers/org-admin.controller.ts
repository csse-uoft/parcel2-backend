import { Request, Response } from "express";
import User from "../models/user.model";
import { generatePassword } from "../services/auth.service";
import { createUser } from "../services/user.service";
import { RequestUser } from "../middleware/auth.middleware";
import { normalizeRoles, UserRole } from "../constants/roles";
import { sendOrganizationInvitationMail } from "../services/email";
import { Organization } from "../models/organization.model";
import { applyOrganizationUpdates } from "../services/organization.service";

export async function listOrganizationUsers(req: Request, res: Response) {
    const requestUser = (req as any).user as RequestUser;

    if (!requestUser.organizationIRI) {
        res.status(400).json({ message: "Organization not linked to requesting admin" });
        return;
    }

    try {
        const users = await User.find({ organizationIRI: requestUser.organizationIRI })
            .select("-password")
            .lean();
        res.json(users);
    } catch (error) {
        console.error("listOrganizationUsers error", error);
        res.status(500).json({ message: "Error fetching organization users" });
    }
}

export async function resetOrganizationUserPassword(req: Request, res: Response) {
    const requestUser = (req as any).user as RequestUser;
    const userId = req.params.userId;

    if (!requestUser.organizationIRI) {
        res.status(400).json({ message: "Organization not linked to requesting admin" });
        return;
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        if (user.organizationIRI !== requestUser.organizationIRI) {
            res.status(403).json({ message: "Target user is not in your organization" });
            return;
        }

        const roles = Array.isArray(user.roles) ? (user.roles as UserRole[]) : [];
        if (roles.includes(UserRole.ADMIN)) {
            res.status(403).json({ message: "Cannot reset passwords for administrative accounts" });
            return;
        }

        const newPassword = generatePassword();
        user.password = newPassword;
        await user.save();

        res.json({ message: "Password reset", newPassword });
    } catch (error) {
        console.error("resetOrganizationUserPassword error", error);
        res.status(500).json({ message: "Error resetting password" });
    }
}

export async function deleteOrganizationUser(req: Request, res: Response) {
    const requestUser = (req as any).user as RequestUser;
    const userId = req.params.userId;

    if (!requestUser.organizationIRI) {
        res.status(400).json({ message: "Organization not linked to requesting admin" });
        return;
    }

    if (!userId) {
        res.status(400).json({ message: "User ID is required" });
        return;
    }

    if (requestUser.id === userId) {
        res.status(400).json({ message: "You cannot delete your own account" });
        return;
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        if (user.organizationIRI !== requestUser.organizationIRI) {
            res.status(403).json({ message: "Target user is not in your organization" });
            return;
        }

        const roles = Array.isArray(user.roles) ? user.roles : [];
        const protectedRoles = new Set([UserRole.ADMIN, UserRole.ORG_ADMIN]);
        if (roles.some((role) => protectedRoles.has(role as UserRole))) {
            res.status(403).json({ message: "Cannot delete administrative accounts" });
            return;
        }

        await user.deleteOne();
        res.json({ message: "User deleted" });
    } catch (error) {
        console.error("deleteOrganizationUser error", error);
        res.status(500).json({ message: "Error deleting user" });
    }
}

export async function inviteUserToOrganization(req: Request, res: Response) {
    const requestUser = (req as any).user as RequestUser;

    const { username, email, roles, sendEmail, organizationIri } = req.body ?? {};
    if (!username || !email) {
        res.status(400).json({ message: "Username and email are required" });
        return;
    }

    try {
        const password = generatePassword(12);
        let normalizedRoles = normalizeRoles(roles ?? [UserRole.USER]);
        const isAdmin = requestUser.roles.includes(UserRole.ADMIN);
        if (!isAdmin) {
            normalizedRoles = normalizedRoles.filter((role) => role !== UserRole.ADMIN);
        }
        if (!normalizedRoles.includes(UserRole.USER)) {
            normalizedRoles.push(UserRole.USER);
        }

        let targetOrganizationIri: string | undefined = typeof organizationIri === "string" && organizationIri.trim().length
            ? organizationIri.trim()
            : undefined;

        if (!isAdmin) {
            if (!requestUser.organizationIRI) {
                res.status(400).json({ message: "Organization not linked to requesting admin" });
                return;
            }
            targetOrganizationIri = requestUser.organizationIRI ?? targetOrganizationIri;
        }

        if (!targetOrganizationIri) {
            res.status(400).json({ message: "Organization is required" });
            return;
        }

        if (!isAdmin && requestUser.organizationIRI && targetOrganizationIri !== requestUser.organizationIRI) {
            res.status(403).json({ message: "Cannot invite to another organization" });
            return;
        }

        const organization = await Organization.findByIri<Organization>(targetOrganizationIri);
        if (!organization) {
            res.status(404).json({ message: "Organization not found" });
            return;
        }

        const invited = await createUser({
            username,
            email,
            password,
            organizationIRI: organization.iri,
            roles: normalizedRoles,
        });

        const shouldSendEmail = typeof sendEmail === "string" ? sendEmail === "true" : Boolean(sendEmail);
        let emailSent = false;
        if (shouldSendEmail) {
            let organizationName: string | undefined = organization.name ?? organization.legalNames?.[0]?.hasValue;

            try {
                await sendOrganizationInvitationMail({
                    email,
                    temporaryPassword: password,
                    organizationName,
                });
                emailSent = true;
            } catch (mailErr) {
                console.error("inviteUserToOrganization: error sending invitation email", mailErr);
            }
        }

        res.status(201).json({
            message: "User invited",
            user: {
                id: invited._id,
                username: invited.username,
                email: invited.email,
                organizationIRI: invited.organizationIRI,
                roles: invited.roles,
            },
            temporaryPassword: password,
            emailSent,
        });
    } catch (error: any) {
        console.error("inviteUserToOrganization error", error);
        const status = error?.status ?? 500;
        res.status(status).json({ message: error?.message ?? "Error inviting user" });
    }
}

export async function getManagedOrganization(req: Request, res: Response) {
    const requestUser = (req as any).user as RequestUser;

    if (!requestUser.organizationIRI) {
        res.status(400).json({ message: "Organization not linked to requesting admin" });
        return;
    }

    try {
        const organization = await Organization.findByIri<Organization>(requestUser.organizationIRI);
        if (!organization) {
            res.status(404).json({ message: "Organization not found" });
            return;
        }

        res.json(organization.toJSON());
    } catch (error) {
        console.error("getManagedOrganization error", error);
        res.status(500).json({ message: "Error fetching organization" });
    }
}

export async function updateManagedOrganization(req: Request, res: Response) {
    const requestUser = (req as any).user as RequestUser;
    const body = req.body?.organization ?? req.body;

    if (!requestUser.organizationIRI) {
        res.status(400).json({ message: "Organization not linked to requesting admin" });
        return;
    }

    if (!body || typeof body !== "object") {
        res.status(400).json({ message: "Organization payload is required" });
        return;
    }

    try {
        const organization = await Organization.findByIri<Organization>(requestUser.organizationIRI);
        if (!organization) {
            res.status(404).json({ message: "Organization not found" });
            return;
        }

        applyOrganizationUpdates(organization, body);
        await organization.save();

        res.json(organization.toJSON());
    } catch (error) {
        console.error("updateManagedOrganization error", error);
        res.status(500).json({ message: "Error updating organization" });
    }
}
