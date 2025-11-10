import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
    getUserOrg,
    getUserProfile,
    initUserProfile,
    updateUserOrg,
    updateUserProfile,
    changeUserPassword,
    getOpportunityFavourites,
    addOpportunityFavourite,
    removeOpportunityFavourite,
} from "../controllers/user.controller";

const router = express.Router();

router.get("/profile", authenticate, getUserProfile);
router.post("/profile/init", authenticate, initUserProfile);
router.post("/profile", authenticate, updateUserProfile);
router.get("/profile/org", authenticate, getUserOrg);
router.post("/profile/org", authenticate, updateUserOrg);
router.post("/profile/password", authenticate, changeUserPassword);
router.get("/user/favourites", authenticate, getOpportunityFavourites);
router.post("/user/favourites", authenticate, addOpportunityFavourite);
router.delete("/user/favourites/:opportunityIri", authenticate, removeOpportunityFavourite);

export default router;
