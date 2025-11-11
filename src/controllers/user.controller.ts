import { Request, Response } from "express";
import User, { IOpportunityFavourite } from "../models/user.model";
import { Person } from "../models/person.model";
import { Organization } from "../models/organization.model";
import { Opportunity } from "../models";
import { getUserOrganization } from "../services/user.service";
import { ServiceError } from "../utils/errors";

type OpportunityFavouriteResponse = {
    iri: string;
    name?: string;
    organizationName?: string;
    projectTypeName?: string;
    stageName?: string;
    addedAt: string;
};

function normaliseString(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function toIsoString(value: Date | string | undefined | null): string {
    if (!value) return new Date().toISOString();
    if (value instanceof Date) return value.toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function extractLabel(value: unknown): string | undefined {
    if (!value) return undefined;
    if (typeof value === "string") return normaliseString(value);
    if (typeof value === "object") {
        const candidate = (value as any).name ?? (value as any).label ?? (value as any).title ?? (value as any).description;
        return normaliseString(candidate);
    }
    return undefined;
}

async function buildOpportunityOrganizationMap(targetIris: Set<string>): Promise<Map<string, string | undefined>> {
    const map = new Map<string, string | undefined>();
    if (targetIris.size === 0) return map;

    try {
        const organizations = await Organization.findAll<Organization>(1000, 0);
        for (const org of organizations ?? []) {
            const name = normaliseString(org?.name ?? org?.tradeName ?? org?.briefDescription);
            const opportunities = org?.opportunities ?? [];
            for (const entry of opportunities) {
                if (!entry) continue;
                let iri: string | undefined;
                if (typeof entry === "string") {
                    iri = entry;
                } else if (typeof entry === "object") {
                    const candidate = (entry as any).iri ?? (entry as any)["@id"] ?? (entry as any).id;
                    if (typeof candidate === "string") {
                        iri = candidate;
                    } else if (typeof candidate === "object" && candidate?.value) {
                        iri = String(candidate.value);
                    }
                }
                if (!iri || !targetIris.has(iri)) continue;
                if (!map.has(iri)) {
                    map.set(iri, name);
                }
            }
        }
    } catch (error) {
        console.error("Failed to build organisation index for favourites", error);
    }

    return map;
}

async function hydrateOpportunityFavourites(items: IOpportunityFavourite[] | undefined | null): Promise<OpportunityFavouriteResponse[]> {
    if (!items || !Array.isArray(items) || items.length === 0) return [];

    const normalised = items
        .map((raw) => {
            const source: any = raw as any;
            const item: any = source && typeof source.toObject === "function" ? source.toObject() : source;
            const iriRaw = item?.opportunityIri;
            const iri = typeof iriRaw === "string" ? iriRaw.trim() : typeof iriRaw === "number" ? String(iriRaw) : "";
            if (!iri) return null;
            return {
                iri,
                addedAt: toIsoString(item?.addedAt),
            };
        })
        .filter((entry): entry is { iri: string; addedAt: string } => Boolean(entry));

    if (normalised.length === 0) return [];

    const uniqueIris = Array.from(new Set(normalised.map((entry) => entry.iri)));
    const opportunityMap = new Map<string, Opportunity>();

    await Promise.all(
        uniqueIris.map(async (iri) => {
            try {
                const opportunity = await Opportunity.findByIri<Opportunity>(iri);
                if (opportunity) {
                    opportunityMap.set(iri, opportunity);
                }
            } catch (error) {
                console.error(`Failed to hydrate favourite opportunity ${iri}`, error);
            }
        }),
    );

    const organizationMap = await buildOpportunityOrganizationMap(new Set(uniqueIris));

    return normalised.map(({ iri, addedAt }) => {
        const opportunity = opportunityMap.get(iri) ?? null;
        const rawName = opportunity ? (opportunity as any).name : undefined;
        const name = normaliseString(typeof rawName === "string" ? rawName : undefined);
        const projectTypeName = opportunity ? extractLabel((opportunity as any).projectType) : undefined;
        const stageName = opportunity ? extractLabel((opportunity as any).projectStage) : undefined;

        return {
            iri,
            name,
            organizationName: organizationMap.get(iri),
            projectTypeName,
            stageName,
            addedAt,
        };
    });
}

export const getUserProfile = async (req: Request, res: Response) => {
    try {
    const user = await User.findById((req as any).user.id).select("-password");
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
    const userId = (req as any).user.id;
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

        await person.save();

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
    const userId = (req as any).user.id;
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
        if (user) {
            user.personIRI = person.iri;
            await user.save();
        }

        res.json(person);
    } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({ message: "Error updating user profile" });
    }
}

export async function updateUserOrg(req: Request, res: Response) {
    const userId = (req as any).user.id;
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
            delete organizationData.iri; // Ensure we don't overwrite the IRI
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
    const userId = (req as any).user.id;
    try {
        const organization = await getUserOrganization(userId);
        res.json(organization);
    } catch (err) {
        if (err instanceof ServiceError && err.status === 404) {
            res.status(404).json({ message: "User organization not found" });
            return;
        }
        console.error("Error in getUserOrganization:", err);
        res.status(500).json({ message: "Error fetching user organization" });
        return;
    }
}

export async function changeUserPassword(req: Request, res: Response) {
    const userId = (req as any).user.id;
    const { currentPassword, newPassword } = req.body ?? {};

    try {
        if (typeof newPassword !== "string" || newPassword.length < 8) {
            res.status(400).json({ message: "New password must be at least 8 characters." });
            return;
        }

        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const hasExistingPassword = !!user.password;

        if (hasExistingPassword) {
            if (typeof currentPassword !== "string" || currentPassword.length === 0) {
                res.status(400).json({ message: "Current password is required." });
                return;
            }

            const matches = await user.comparePassword(currentPassword);
            if (!matches) {
                res.status(400).json({ message: "Current password is incorrect." });
                return;
            }
        }

        user.password = newPassword;
        await user.save();

        res.json({ message: "Password updated successfully." });
    } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).json({ message: "Error updating password" });
    }
}

export async function getOpportunityFavourites(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id;
        const user = await User.findById(userId).select("opportunityFavourites");
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const favourites = await hydrateOpportunityFavourites(user.opportunityFavourites);
        res.json({ favourites });
    } catch (error) {
        console.error("Error fetching opportunity favourites:", error);
        res.status(500).json({ message: "Error fetching favourites" });
    }
}

export async function addOpportunityFavourite(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id;
        const { opportunityIri } = req.body ?? {};

        if (typeof opportunityIri !== "string" || opportunityIri.trim().length === 0) {
            res.status(400).json({ message: "opportunityIri is required" });
            return;
        }

        const user = await User.findById(userId).select("opportunityFavourites");
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const trimmedIri = opportunityIri.trim();
        const current = Array.isArray(user.opportunityFavourites) ? [...user.opportunityFavourites] : [];
        const existingIndex = current.findIndex((item: any) => String(item.opportunityIri) === trimmedIri);

        const baseEntry: IOpportunityFavourite = {
            opportunityIri: trimmedIri,
            addedAt: new Date(),
        };

        let updated: IOpportunityFavourite[];

        if (existingIndex >= 0) {
            const existing = current[existingIndex] as IOpportunityFavourite;
            const addedAt = existing?.addedAt instanceof Date ? existing.addedAt : existing?.addedAt ? new Date(existing.addedAt) : new Date();
            const merged: IOpportunityFavourite = {
                opportunityIri: trimmedIri,
                addedAt,
            };

            const rest = current.filter((_, idx) => idx !== existingIndex) as IOpportunityFavourite[];
            updated = [merged, ...rest];
        } else {
            updated = [baseEntry, ...(current as IOpportunityFavourite[])];
        }

        user.opportunityFavourites = updated;
        await user.save();

        const favourites = await hydrateOpportunityFavourites(user.opportunityFavourites);
        res.json({ favourites });
    } catch (error) {
        console.error("Error adding opportunity favourite:", error);
        res.status(500).json({ message: "Error saving favourite" });
    }
}

export async function removeOpportunityFavourite(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id;
        const param = req.params.opportunityIri ?? "";
        const decoded = typeof param === "string" ? decodeURIComponent(param) : "";
        if (!decoded) {
            res.status(400).json({ message: "opportunityIri is required" });
            return;
        }

        const user = await User.findById(userId).select("opportunityFavourites");
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const current = Array.isArray(user.opportunityFavourites) ? user.opportunityFavourites : [];
        const filtered = current.filter((item: any) => String(item.opportunityIri) !== decoded) as IOpportunityFavourite[];

        user.opportunityFavourites = filtered;
        await user.save();

        const favourites = await hydrateOpportunityFavourites(user.opportunityFavourites);
        res.json({ favourites });
    } catch (error) {
        console.error("Error removing opportunity favourite:", error);
        res.status(500).json({ message: "Error removing favourite" });
    }
}
