import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
	createChat,
	getChatMessages,
	getChatRoomDetails,
	listUserChats,
	postChatMessage,
} from "../controllers/chat.controller";

const router = express.Router();

router.use(authenticate);

router.post("/", createChat);
router.get("/", listUserChats);
router.get("/:roomId/messages", getChatMessages);
router.post("/:roomId/messages", postChatMessage);
router.get("/:roomId", getChatRoomDetails);

export default router;
