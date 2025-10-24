import { Request, Response } from "express";
import User from "../models/user.model";
import { Organization } from "../models/organization.model";
import { generatePassword } from "../services/auth.service";
import { normalizeRoles } from "../constants/roles";

export async function listUsers(req: Request, res: Response) {
    try {
        const users = await User.find().select("-password").lean();
        res.json(users);
    } catch (error) {
        console.error("listUsers error", error);
        res.status(500).json({ message: "Error fetching users" });
    }
}

export async function listOrganizations(req: Request, res: Response) {
    try {
        const organizations = await Organization.findAll<Organization>(500);
        res.json(organizations);
    } catch (error) {
        console.error("listOrganizations error", error);
        res.status(500).json({ message: "Error fetching organizations" });
    }
}

export async function assignUserOrganization(req: Request, res: Response) {
    const { organizationIri, organization } = req.body ?? {};
    const userId = req.params.userId;

    try {
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        let targetOrg: Organization | null = null;
        if (organizationIri) {
            targetOrg = await Organization.findByIri<Organization>(organizationIri);
            if (!targetOrg) {
                res.status(404).json({ message: "Organization not found" });
                return;
            }
        } else if (organization) {
            targetOrg = Organization.create(organization);
            targetOrg.assignIRI();
            await targetOrg.save();
        } else {
            res.status(400).json({ message: "Provide organizationIri or organization payload" });
            return;
        }

        user.organizationIRI = targetOrg.iri;
        await user.save();

        res.json({ message: "Organization linked", organizationIri: targetOrg.iri });
    } catch (error) {
        console.error("assignUserOrganization error", error);
        res.status(500).json({ message: "Error linking organization" });
    }
}

export async function resetUserPassword(req: Request, res: Response) {
    const userId = req.params.userId;
    try {
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const newPassword = generatePassword();
        user.password = newPassword;
        await user.save();

        res.json({ message: "Password reset", newPassword });
    } catch (error) {
        console.error("resetUserPassword error", error);
        res.status(500).json({ message: "Error resetting password" });
    }
}

export async function updateUserRoles(req: Request, res: Response) {
    const userId = req.params.userId;
    const { roles } = req.body ?? {};
    try {
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        user.roles = normalizeRoles(roles);
        await user.save();
        res.json({ message: "Roles updated", roles: user.roles });
    } catch (error) {
        console.error("updateUserRoles error", error);
        res.status(500).json({ message: "Error updating roles" });
    }
}
