import { Request, Response, Router } from 'express';
import { finalizeUrlList, isTmpUrl } from '../services/uploads';
import { Opportunity, OpportunityAdditionalInfo, Organization, ProjectStage } from "../models";
import User from "../models/user.model";
import { getUserOrganization } from "../services/user.service";
import { ServiceError } from "../utils/errors";
import { getTaxonomyOptionByIri } from "../taxonomy";

async function attachUploads(opportunity: Opportunity, additionalInfo: any) {
    const opportunityIRIWithoutPrefix = opportunity.iri!.split(':').pop()!;
    const imagesFinal = await finalizeUrlList(opportunityIRIWithoutPrefix, additionalInfo.images ?? []);
    const filesFinal = await finalizeUrlList(opportunityIRIWithoutPrefix, additionalInfo.files ?? []);

    if (!opportunity.additionalInfo) {
        opportunity.additionalInfo = OpportunityAdditionalInfo.create({});
    }

    // if primaryImage was tmp, map it to the new final URL (by index)
    let primaryImage: string | undefined = additionalInfo.primaryImage;
    if (primaryImage && isTmpUrl(primaryImage)) {
        const oldIdx = (additionalInfo.images ?? []).indexOf(primaryImage);
        primaryImage = imagesFinal[oldIdx] ?? imagesFinal[0] ?? '';
        opportunity.additionalInfo.primaryImage = primaryImage;
    }

    opportunity.additionalInfo.images = imagesFinal;
    opportunity.additionalInfo.files = filesFinal;
    return { imagesFinal, filesFinal };
}

// function transformTaxonomies(opportunity: Opportunity) {
//     // ensure taxonomies are arrays of strings
//     if (!opportunity) return;
//     if (opportunity.projectStage && typeof opportunity.projectStage === 'string') {
//         opportunity.projectStage = getTaxonomyOptionByIri(ProjectStage, opportunity.projectStage);
//     }
//     if (opportunity.projectType && typeof opportunity.projectType === 'string') {
//         opportunity.projectType = getTaxonomyOptionByIri(ProjectStage, opportunity.projectType);
//     }
//
//     const taxonomies = ['projectType', 'projectStage', 'partnershipRoles'];
//     for (const field of taxonomies) {
//         if (body[field] && !Array.isArray(body[field])) {
//             body[field] = [body[field]];
//         }
//     }
// }
//

export async function createOpportunity(req: Request, res: Response) {
    const body = req.body ?? {};
    const ai = body.additionalInfo ?? {};

    try {
        const opportunity = Opportunity.create(body);
        opportunity.assignIRI();
        await attachUploads(opportunity, ai);
        opportunity.additionalInfo!.datePosted = opportunity.additionalInfo!.dateModified = new Date();

        // attach opportunity to the creator organization
        const userId = (req as any).user.userId;
        const user = await User.findById(userId);
        if (!user || !user.organizationIRI) {
            res.status(404).json({ message: "Organization not found (no organizationIRI)" });
            return;
        }

        const organization = await Organization.findByIri<Organization>(user.organizationIRI);
        if (!organization) {
            res.status(404).json({ message: "Organization not found" });
            return;
        }
        // deduplicate
        organization.opportunities = [...new Set([...(organization.opportunities ?? []), opportunity])].filter(op => op != null);
        await organization.save();
        await opportunity.save();

        res.status(201).json(opportunity);

    } catch (error) {
        console.error(error);
        res.status(400).json({ message: 'Error creating opportunity', error });
        return;
    }
}

export async function updateOpportunityByIri(req: Request, res: Response) {
    const opportunityIri = req.params.iri;
    const body = req.body ?? {};
    const ai = body.additionalInfo ?? {};

    // TODO: check ownership (only org that created it can update)

    try {
        const opportunity = await Opportunity.findByIri<Opportunity>(opportunityIri);
        if (!opportunity) {
            res.status(404).json({ message: 'Opportunity not found' });
            return;
        }
        // merge updates
        Object.assign(opportunity.additionalInfo!, ai, { datePosted: opportunity.additionalInfo!.datePosted ?? new Date() });
        delete body.additionalInfo;
        Object.assign(opportunity, body);

        await attachUploads(opportunity, ai);
        opportunity.additionalInfo!.dateModified = new Date();

        await opportunity.save();

        res.status(200).json(opportunity);

    } catch (error) {
        console.log(error);
        res.status(400).json({ message: 'Error updating opportunity', error });
        return;
    }
}

export async function getOpportunityByIri(req: Request, res: Response) {
    const opportunityIri = req.params.iri;

    try {
        const opportunity = await Opportunity.findByIri<Opportunity>(opportunityIri);
        if (!opportunity) {
            res.status(404).json({ message: 'Opportunity not found' });
            return;
        }

        res.status(200).json(opportunity);

    } catch (error) {
        console.error(error);
        res.status(400).json({ message: 'Error fetching opportunity', error });
        return;
    }
}

export async function deleteOpportunityByIri(req: Request, res: Response) {
    const opportunityIri = req.params.iri;

    try {
        const opportunity = await Opportunity.findByIri<Opportunity>(opportunityIri);
        if (!opportunity) {
            res.status(404).json({ message: 'Opportunity not found' });
            return;
        }

        await opportunity.delete({ cascade: true });

        // detach opportunity from the creator organization
        const userId = (req as any).user.userId;
        try {
            const organization = await getUserOrganization(userId);

            // check ownership
            // organization.opportunities should be already populated, but we are checking both just in case
            if (organization.opportunities?.findIndex(op => op === opportunity.iri || (op as Opportunity).iri === opportunity.iri) === -1) {
                res.status(403).json({ message: 'Forbidden: You do not have permission to delete this opportunity' });
                return;
            }

            organization.opportunities = [...organization.opportunities!.filter(iri => iri !== opportunity.iri)];
            await organization.save();
            await opportunity.save();

        } catch (err) {
            if (err instanceof ServiceError) {
                res.status(err.status).json({ message: err.message });
                return;
            } else {
                console.error(err);
                throw err;
            }
        }

        res.status(200).json({ message: 'Opportunity deleted' });

    } catch (error) {
        res.status(500).json({ message: 'Error deleting opportunity', error });
        return;
    }
}

export async function getAllOpportunities(req: Request, res: Response) {
    try {
        const opportunities = await Opportunity.findAll<Opportunity>();
        res.status(200).json(opportunities);
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: 'Error fetching opportunities', error });
        return;
    }
}


export async function getUserOpportunities(req: Request, res: Response) {
    const userId = (req as any).user.userId;

    try {
        const organization = await getUserOrganization(userId);
        if (!organization.opportunities?.length) {
            res.status(200).json([]);
            return;
        }
        const opportunities = organization.opportunities.filter(op => op != null);

        // const opportunities = await Opportunity.find({ iri: organization.opportunities }) as Opportunity[];
        res.status(200).json(opportunities);
    } catch (error) {
        console.error(error);
        if (error instanceof ServiceError) {
            res.status(error.status).json({ message: error.message });
            return;
        }
        res.status(400).json({ message: 'Error fetching user opportunities', error });
        return;
    }
}