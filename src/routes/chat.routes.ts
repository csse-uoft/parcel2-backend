import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import { sendMessage, getMessages } from "../controllers/chat.controller";

const router = express.Router();

router.post("/send", authenticate, sendMessage);
router.get("/:room", authenticate, getMessages);

export default router;
