import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getTaxonomy } from "../controllers/taxonomy.controller";

const router = express.Router();

router.get("/:iri", authenticate, getTaxonomy);

export default router;
