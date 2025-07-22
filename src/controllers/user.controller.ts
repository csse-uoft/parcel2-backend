import { Request, Response } from "express";
import User from "../models/user.model";
import { Person } from "../models/person.model";
import { Organization } from "../models/organization.model";
import { getAuthTokenDecoded } from "../services/auth.service";

export const getUserProfile = async (req: Request, res: Response) => {
    try {
        const user = await User.findById((req as any).user.userId).select("-password");
        const userJSON: any = user?.toJSON();
        if (user?.personIRI) {
            const person = await Person.findByIri(user.personIRI);
            if (person) {
                userJSON.person = person.toJSON();
            } else {
                userJSON.person = null; // Person not found
            }
        }

        res.json(userJSON);
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ message: "Error fetching user profile" });
    }
};

export async function initUserProfile(req: Request, res: Response) {
    try {
        const userId = (req as any).user.userId;
        const { person: personData } = req.body;

        // Validate the person object
        if (!personData || typeof personData !== 'object') {
            res.status(400).json({ message: "Invalid person data" });
            return;
        }

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        let person: Person | null = null;
        if (user?.personIRI) {
            person = await Person.findByIri(user.personIRI);
        }
        if (!person) {
            person = Person.create(personData);
        } else {
            // Update existing person data
            Object.assign(person, personData);
        }

        // Update user's personIRI
        user.personIRI = person.iri;
        user.isRegistrationComplete = true;
        await user.save();

        res.json(person);
    } catch (error) {
        console.error("Error initializing user profile:", error);
        res.status(500).json({ message: "Error initializing user profile" });
    }
}

export async function updateUserProfile(req: Request, res: Response) {
    try {
        const userId = (req as any).user.userId;
        const { person: personData } = req.body;

        // Validate the person object
        if (!personData || typeof personData !== 'object') {
            res.status(400).json({ message: "Invalid person data" });
            return;
        }

        // Find and update the user
        const user = await User.findById(userId);

        let person: Person | null = null;
        if (user?.personIRI) {
            person = await Person.findByIri(user.personIRI);
        }
        if (!person) {
            person = Person.create(personData);
        } else {
            // Update existing person data
            Object.assign(person, personData);
        }

        await person.save();
        user!.personIRI = person.iri;

        res.json(person);
    } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({ message: "Error updating user profile" });
    }
}

export async function updateUserOrg(req: Request, res: Response) {
    const userId = (req as any).user.userId;
    const { organization: organizationData } = req.body;
    try {
        const user = await User.findById(userId);

        let organization: Organization | null = null;
        if (user?.organizationIRI) {
            organization = await Organization.findByIri(user.organizationIRI);
        }
        if (!organization) {
            organization = Organization.create(organizationData);
        } else {
            // Update existing organization data
            Object.assign(organization, organizationData);
        }
        console.log("Updating organization:", organization);
        await organization.save();
        user!.organizationIRI = organization.iri;

        await user!.save();

        res.json(organization);

    } catch (error) {
        res.status(500).json({ message: "Error updating user profile" });
        console.error("Error updating user organization:", error);
    }
}

export async function getUserOrg(req: Request, res: Response) {
    try {
        const userId = (req as any).user.userId;
        const user = await User.findById(userId);

        if (!user || !user.organizationIRI) {
            res.status(404).json({ message: "Organization not found (no organizationIRI)" });
            return;
        }

        const organization = await Organization.findByIri(user.organizationIRI);
        if (!organization) {
            res.status(404).json({ message: "Organization not found" });
            return;
        }

        res.json(organization);
    } catch (error) {
        console.error("Error fetching user organization:", error);
        res.status(500).json({ message: "Error fetching user organization" });
    }
}
