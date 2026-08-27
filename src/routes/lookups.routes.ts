/**
 * Lookups routes — dropdown data for profile setup.
 */
import { Router } from "express";
import { verifyAuth } from "../middleware/verifyAuth";
import { getLookups, getOrganisationsByFilter } from "../controllers/lookupsController";

const router = Router();

/**
 * GET /api/lookups/:type
 * Returns dropdown data. Protected — requires auth.
 */
router.get("/lookups/:type", verifyAuth, getLookups);

/**
 * GET /api/lookups/organisations?ministry=X
 * Returns organisations filtered by ministry.
 */
router.get("/lookups/organisations/filter", verifyAuth, getOrganisationsByFilter);

export default router;