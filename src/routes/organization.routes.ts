import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import { createOrg, deleteOrg, getAllOrgs, getOrg, updateOrg } from "../controllers/organization.controller";

const router = express.Router();

// Create a new organization
router.post("/organizations", authenticate, createOrg);

// Get organization details
router.get("/organizations/:iri", authenticate, getOrg);

// Update organization details
router.post("/organizations/:iri", authenticate, updateOrg);

// Delete an organization
router.delete("/organizations/:iri", authenticate, deleteOrg);

// Get all organizations
router.get("/organizations", authenticate, getAllOrgs);


export default router;
