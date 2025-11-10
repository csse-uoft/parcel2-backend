import { Request, Response } from "express";

import {
    assertCanAccessChatRoom,
    findChatRoomById,
    getOrCreateChatRoom,
    listChatRooms,
    loadMessages,
    recordChatMessage,
    toChatRoomSummary,
} from "../services/chat.service";
import { RequestUser } from "../middleware/auth.middleware";
import { ServiceError } from "../utils/errors";

function getRequestUser(req: Request): RequestUser {
    return (req as any).user as RequestUser;
}

function sendError(res: Response, error: unknown) {
    if (error instanceof ServiceError) {
        res.status(error.status).json({ message: error.message });
        return;
    }
    console.error("Chat controller error", error);
    res.status(500).json({ message: "Unexpected error" });
}

export async function createChat(req: Request, res: Response) {
    const user = getRequestUser(req);
    const { opportunityIri, organizationIri } = req.body ?? {};

    try {
    const room = await getOrCreateChatRoom(opportunityIri, organizationIri, user);
    const summary = toChatRoomSummary(room);
    res.status(200).json({ room: summary });
    } catch (error) {
        sendError(res, error);
    }
}

export async function listUserChats(req: Request, res: Response) {
    const user = getRequestUser(req);
    try {
        const rooms = await listChatRooms(user);
        res.json({ items: rooms });
    } catch (error) {
        sendError(res, error);
    }
}

export async function getChatRoomDetails(req: Request, res: Response) {
    const user = getRequestUser(req);
    const { roomId } = req.params;
    try {
        const room = await findChatRoomById(roomId);
        assertCanAccessChatRoom(room, user);
        res.json({ room: toChatRoomSummary(room) });
    } catch (error) {
        sendError(res, error);
    }
}

export async function getChatMessages(req: Request, res: Response) {
    const user = getRequestUser(req);
    const { roomId } = req.params;
    const { limit, before } = req.query ?? {};

    try {
        const room = await findChatRoomById(roomId);
        assertCanAccessChatRoom(room, user);

        let beforeDate: Date | null = null;
        if (before) {
            const parsed = new Date(String(before));
            if (Number.isNaN(parsed.getTime())) {
                throw new ServiceError("Invalid 'before' parameter", 400);
            }
            beforeDate = parsed;
        }

        const messages = await loadMessages({
            room,
            limit: limit ? Number(limit) : undefined,
            before: beforeDate,
        });

        res.json({ items: messages });
    } catch (error) {
        sendError(res, error);
    }
}

export async function postChatMessage(req: Request, res: Response) {
    const user = getRequestUser(req);
    const { roomId } = req.params;
    const { text, fileUrl } = req.body ?? {};

    try {
        const room = await findChatRoomById(roomId);
        assertCanAccessChatRoom(room, user);

        const message = await recordChatMessage({
            room,
            sender: user,
            text,
            fileUrl,
        });

        res.status(201).json({ message });
    } catch (error) {
        sendError(res, error);
    }
}
