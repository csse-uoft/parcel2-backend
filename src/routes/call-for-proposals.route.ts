import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
    listCallForProposals,
    getCallForProposalByIri,
    createCallForProposal,
    updateCallForProposal,
    deleteCallForProposal,
    listApplicationsForCall,
    createApplicationForCall,
    updateApplicationForCall,
    deleteApplicationForCall,
} from "../controllers/call-for-proposals.controller";

const router = Router();

router.get("/", authenticate, listCallForProposals);
router.post("/", authenticate, createCallForProposal);
router.get("/:iri", authenticate, getCallForProposalByIri);
router.post("/:iri", authenticate, updateCallForProposal);
router.delete("/:iri", authenticate, deleteCallForProposal);

router.get("/:iri/applications", authenticate, listApplicationsForCall);
router.post("/:iri/applications", authenticate, createApplicationForCall);
router.post("/:iri/applications/:applicationIri", authenticate, updateApplicationForCall);
router.delete("/:iri/applications/:applicationIri", authenticate, deleteApplicationForCall);

export default router;
