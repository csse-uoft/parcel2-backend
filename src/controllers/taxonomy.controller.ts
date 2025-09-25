import { Request, Response } from "express";
import { getTaxonomyByIri } from "../taxonomy";
import { PM } from "../services/prefixes";


export const getTaxonomy = async (req: Request, res: Response) => {
    try {
        res.json(getTaxonomyByIri(PM.ensurePrefixed(req.params.iri)));
    } catch (error) {
        res.status(500).json({ message: "Error fetching messages" });
    }
};
