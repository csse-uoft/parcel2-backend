import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import { searchAddress } from "../controllers/geocode.controller";

const router = express.Router();

router.post("/search", authenticate, searchAddress);

export default router;
