import { Request, Response } from "express";
import { Organization } from "../models/organization.model";
import { PM } from "../services/prefixes";

export async function createOrg(req: Request, res: Response) {
    try {
        const org = Organization.create(req.body);
        await org.save();
        res.status(201).json(org);
    } catch (e) {
        res.status(400).json({ error: (e as Error).message });
    }
}

export async function getOrg(req: Request, res: Response) {
    try {
        if (!req.params.iri) {
            res.status(400).json({ error: "IRI parameter is required" });
            return;
        }

        const org = await Organization.findByIri(PM.ensureExpanded(req.params.iri));
        if (!org) {
            res.status(404).json({ error: "Organization not found" });
            return;
        }
        res.json(org);
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
}


export async function updateOrg(req: Request, res: Response) {
    try {
        if (!req.params.iri) {
            res.status(400).json({ error: "IRI parameter is required" });
            return;
        }
        const org = await Organization.findByIri(PM.ensureExpanded(req.params.iri));
        if (!org) {
            res.status(404).json({ error: "Organization not found" });
            return;
        }
        Object.assign(org, req.body);
        await org.save();
        res.json(org);
    } catch (e) {
        res.status(400).json({ error: (e as Error).message });
    }
}

export async function deleteOrg(req: Request, res: Response) {
    try {
        if (!req.params.iri) {
            res.status(400).json({ error: "IRI parameter is required" });
            return;
        }
        const org = await Organization.findByIri(PM.ensureExpanded(req.params.iri));
        if (!org) {
            res.status(404).json({ error: "Organization not found" });
            return;
        }
        await org.delete({ cascade: true });
        res.status(204).send();
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
}

export async function getAllOrgs(req: Request, res: Response) {
    const limit  = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);

    try {
        const orgs = await Organization.findAll(limit, offset);
        res.json(orgs);
        return;
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
}