import { Router } from 'express';
import {
    createOpportunity, deleteOpportunityByIri, getAllOpportunities, getOpportunityByIri, getUserOpportunities,
    updateOpportunityByIri
} from "../controllers/opportunities.controller";
import { searchOpportunities } from "../controllers/opportunities-search.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireOrgAdmin } from "../middleware/roles.middleware";

const router = Router();

/**
 * Expects body like:
 * {
 *   name, description, projectType, projectStage, ...
 *   additionalInfo: {
 *     images: ["/uploads/tmp/images/...", "/uploads/opportunities/42/images/...", ...],
 *     files:  ["/uploads/tmp/files/...", ...],
 *     primaryImage: "/uploads/tmp/images/..." | "/uploads/opportunities/42/images/..."
 *   }
 * }
 */

router.post('/search', searchOpportunities);

router.get('/me', authenticate, getUserOpportunities);

router.post('/', authenticate, requireOrgAdmin, createOpportunity);

router.post('/:iri', authenticate, requireOrgAdmin, updateOpportunityByIri);

router.get('/:iri', authenticate, getOpportunityByIri);

router.delete('/:iri', authenticate, requireOrgAdmin, deleteOpportunityByIri);

router.get('/', authenticate, getAllOpportunities);


export default router;
