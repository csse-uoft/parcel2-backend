import { Request, Response } from "express";
import User from "../models/user.model";
import { generatePassword } from "../services/auth.service";
import { createUser } from "../services/user.service";
import { RequestUser } from "../middleware/auth.middleware";
import { normalizeRoles, UserRole } from "../constants/roles";
import { sendOrganizationInvitationMail } from "../services/email";
import { Organization } from "../models/organization.model";

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

        const newPassword = generatePassword();
        user.password = newPassword;
        await user.save();

        res.json({ message: "Password reset", newPassword });
    } catch (error) {
        console.error("resetOrganizationUserPassword error", error);
        res.status(500).json({ message: "Error resetting password" });
    }
}

export async function inviteUserToOrganization(req: Request, res: Response) {
    const requestUser = (req as any).user as RequestUser;
    if (!requestUser.organizationIRI) {
        res.status(400).json({ message: "Organization not linked to requesting admin" });
        return;
    }

    const { username, email, roles, sendEmail } = req.body ?? {};
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

        const invited = await createUser({
            username,
            email,
            password,
            organizationIRI: requestUser.organizationIRI,
            roles: normalizedRoles,
        });

        const shouldSendEmail = typeof sendEmail === "string" ? sendEmail === "true" : Boolean(sendEmail);
        let emailSent = false;
        if (shouldSendEmail) {
            let organizationName: string | undefined;
            try {
                const organization = requestUser.organizationIRI ? await Organization.findByIri<Organization>(requestUser.organizationIRI) : null;
                organizationName = organization?.name ?? organization?.legalNames?.[0]?.hasValue;
            } catch (orgErr) {
                console.warn("inviteUserToOrganization: failed to load organization for email", orgErr);
            }

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
