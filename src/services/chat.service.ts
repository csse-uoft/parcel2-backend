import { Types } from "mongoose";
import Redis from "ioredis";

import ChatRoom, { ChatRoomDocument } from "../models/chat-room.model";
import Message, { ChatMessageDocument } from "../models/message.model";
import { Organization } from "../models/organization.model";
import { Opportunity } from "../models/opportunity.model";
import { RequestUser } from "../middleware/auth.middleware";
import { UserRole, hasRole } from "../constants/roles";
import { ServiceError } from "../utils/errors";
import { redis as defaultRedis } from "../config/redis";

export const CHAT_CHANNEL = "chat_room";
const CHAT_CACHE_PREFIX = "chat:";
const DEFAULT_LIMIT = 50;

export interface ChatRoomSummary {
    id: string;
    opportunityIri: string;
    organizationIri: string;
    userId: string;
    lastMessage: string | null;
    lastMessageSender: string | null;
    lastMessageAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    user?: {
        id: string;
        username?: string;
        email?: string;
        organizationIRI?: string | null;
    };
}

export interface ChatMessagePayload {
    id: string;
    room: string;
    roomId: string;
    sender: string;
    senderId: string;
    text: string | null;
    fileUrl: string | null;
    timestamp: string;
}

interface SendMessageInput {
    room: ChatRoomDocument;
    sender: RequestUser;
    text?: string | null;
    fileUrl?: string | null;
    redisClient?: Redis | null;
}

interface LoadMessagesInput {
    room: ChatRoomDocument;
    limit?: number;
    before?: Date | null;
    redisClient?: Redis | null;
}

function normalizeIri(value: string): string {
    if (!value || typeof value !== "string") {
        throw new ServiceError("IRI is required", 400);
    }
    return value.trim();
}

function ensureRedis(client?: Redis | null): Redis | null {
    if (client) return client;
    return defaultRedis ?? null;
}

function buildCacheKey(roomId: string): string {
    return `${CHAT_CACHE_PREFIX}${roomId}`;
}

function serializeChatRoom(raw: any): ChatRoomSummary {
    const id = raw._id?.toString?.() ?? String(raw._id);
    const user = raw.userId;
    let userId: string;
    let userPayload: ChatRoomSummary["user"] | undefined;

    if (user && typeof user === "object" && user._id) {
        userId = user._id.toString();
        userPayload = {
            id: userId,
            username: user.username ?? undefined,
            email: user.email ?? undefined,
            organizationIRI: user.organizationIRI ?? null,
        };
    } else {
        userId = typeof user === "string" ? user : raw.userId?.toString?.() ?? String(raw.userId);
    }

    return {
        id,
        opportunityIri: raw.opportunityIri,
        organizationIri: raw.organizationIri,
        userId,
        lastMessage: raw.lastMessage ?? null,
        lastMessageSender: raw.lastMessageSender ?? null,
        lastMessageAt: raw.lastMessageAt ? new Date(raw.lastMessageAt) : null,
        createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
        updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
        user: userPayload,
    };
}

function serializeMessage(doc: ChatMessageDocument | (ChatMessagePayload & { _id?: Types.ObjectId | string })): ChatMessagePayload {
    const id = (doc as any)._id ? (doc as any)._id.toString() : doc.id;
    const room = (doc as any).room ?? doc.roomId;
    const senderIdRaw = (doc as any).senderId ?? (doc as any).sender?.id ?? doc.senderId;
    const timestampValue = (doc as any).timestamp instanceof Date ? (doc as any).timestamp : new Date((doc as any).timestamp);

    return {
        id,
        room: room.toString(),
        roomId: room.toString(),
        sender: (doc as any).sender,
        senderId: senderIdRaw?.toString?.() ?? String(senderIdRaw),
        text: (doc as any).text ?? null,
        fileUrl: (doc as any).fileUrl ?? null,
        timestamp: timestampValue.toISOString(),
    };
}

async function ensureOpportunityOwnership(opportunityIri: string, organizationIri: string) {
    const opportunity = await Opportunity.findByIri<Opportunity>(opportunityIri);
    if (!opportunity) {
        throw new ServiceError("Opportunity not found", 404);
    }

    const organization = await Organization.findByIri<Organization>(organizationIri);
    if (!organization) {
        throw new ServiceError("Organization not found", 404);
    }

    const opportunities = organization.opportunities ?? [];
    const ownsOpportunity = opportunities.some((entry: any) => {
        if (!entry) return false;
        if (typeof entry === "string") {
            return entry === opportunity.iri;
        }
        if (typeof entry === "object") {
            return entry.iri === opportunity.iri;
        }
        return false;
    });

    if (!ownsOpportunity) {
        throw new ServiceError("Organization does not own this opportunity", 400);
    }

    return { opportunity, organization };
}

export async function getOrCreateChatRoom(opportunityIriRaw: string, organizationIriRaw: string, user: RequestUser): Promise<ChatRoomDocument> {
    const opportunityIri = normalizeIri(opportunityIriRaw);
    const organizationIri = normalizeIri(organizationIriRaw);

    await ensureOpportunityOwnership(opportunityIri, organizationIri);

    const userObjectId = new Types.ObjectId(user.id);
    let room = await ChatRoom.findOne({ opportunityIri, userId: userObjectId });

    if (!room) {
        try {
            room = await ChatRoom.create({ opportunityIri, organizationIri, userId: userObjectId });
        } catch (error: any) {
            if (error?.code === 11000) {
                room = await ChatRoom.findOne({ opportunityIri, userId: userObjectId });
            } else {
                throw error;
            }
        }
    } else if (room.organizationIri !== organizationIri) {
        room.organizationIri = organizationIri;
        await room.save();
    }

    return room!;
}

export async function findChatRoomById(roomId: string): Promise<ChatRoomDocument> {
    if (!Types.ObjectId.isValid(roomId)) {
        throw new ServiceError("Invalid chat room id", 400);
    }
    const room = await ChatRoom.findById(roomId);
    if (!room) {
        throw new ServiceError("Chat room not found", 404);
    }
    return room;
}

export function canAccessChatRoom(room: ChatRoomDocument, user: RequestUser): boolean {
    if (hasRole(user.roles, UserRole.ADMIN)) return true;
    if (room.userId.toString() === user.id) return true;
    if (user.organizationIRI && user.organizationIRI === room.organizationIri) return true;
    return false;
}

export function assertCanAccessChatRoom(room: ChatRoomDocument, user: RequestUser): void {
    if (!canAccessChatRoom(room, user)) {
        throw new ServiceError("Forbidden", 403);
    }
}

async function updateRoomMetadata(room: ChatRoomDocument, message: ChatMessagePayload, text?: string | null, fileUrl?: string | null) {
    const fallback = fileUrl ? "File shared" : null;
    const summary = text ?? fallback;
    await ChatRoom.findByIdAndUpdate(room._id, {
        $set: {
            lastMessage: summary,
            lastMessageSender: message.sender,
            lastMessageAt: new Date(message.timestamp),
        },
    }).exec();
}

export async function recordChatMessage({ room, sender, text, fileUrl, redisClient }: SendMessageInput): Promise<ChatMessagePayload> {
    const textValue = typeof text === "string" ? text.trim() : "";
    const fileUrlValue = typeof fileUrl === "string" ? fileUrl.trim() : "";

    if (!textValue && !fileUrlValue) {
        throw new ServiceError("Message content is required", 400);
    }

    const roomObjectId = room._id as Types.ObjectId;
    const roomIdString = roomObjectId.toString();

    const payload: Partial<ChatMessageDocument> = {
        room: roomIdString,
        roomId: roomObjectId,
        sender: sender.username,
        senderId: new Types.ObjectId(sender.id),
        text: textValue || null,
        fileUrl: fileUrlValue || null,
        timestamp: new Date(),
    };

    const doc = await Message.create(payload);
    const serialized = serializeMessage(doc);

    await updateRoomMetadata(room, serialized, payload.text ?? null, payload.fileUrl ?? null);

    const client = ensureRedis(redisClient);
    if (client) {
        const cacheKey = buildCacheKey(roomIdString);
        await client.lpush(cacheKey, JSON.stringify(serialized));
        await client.ltrim(cacheKey, 0, DEFAULT_LIMIT - 1);
        await client.publish(CHAT_CHANNEL, JSON.stringify({ room: serialized.roomId, message: serialized }));
    }

    return serialized;
}

export async function loadMessages({ room, limit, before, redisClient }: LoadMessagesInput): Promise<ChatMessagePayload[]> {
    const effectiveLimit = limit && limit > 0 ? Math.min(limit, 200) : DEFAULT_LIMIT;
    const client = before ? null : ensureRedis(redisClient);
    const roomObjectId = room._id as Types.ObjectId;
    const roomIdString = roomObjectId.toString();

    if (!before && client) {
        const cacheKey = buildCacheKey(roomIdString);
        const cached = await client.lrange(cacheKey, 0, effectiveLimit - 1);
        if (cached.length > 0) {
            const parsed = cached.map(item => serializeMessage(JSON.parse(item)));
            return parsed.reverse();
        }
    }

    const query: Record<string, any> = {
        $or: [
            { roomId: roomObjectId },
            { room: roomIdString },
        ],
    };
    if (before) {
        query.timestamp = { $lt: before };
    }

    const docs = await Message.find(query)
        .sort({ timestamp: -1 })
        .limit(effectiveLimit)
        .exec();

    return docs.reverse().map(doc => serializeMessage(doc));
}

export async function listChatRooms(user: RequestUser): Promise<ChatRoomSummary[]> {
    const isAdmin = hasRole(user.roles, UserRole.ADMIN);

    const filter: Record<string, any> = {};
    if (!isAdmin) {
        const or: Record<string, any>[] = [{ userId: user.id }];
        if (user.organizationIRI) {
            or.push({ organizationIri: user.organizationIRI });
        }
        if (or.length === 1) {
            Object.assign(filter, or[0]);
        } else {
            filter.$or = or;
        }
    }

    const rooms = await ChatRoom.find(filter)
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .populate("userId", "username email organizationIRI")
        .lean()
        .exec();

    return rooms.map(serializeChatRoom);
}

export function toChatRoomSummary(room: ChatRoomDocument | ChatRoomSummary): ChatRoomSummary {
    if ((room as any).id && typeof (room as any).id === "string") {
        return room as ChatRoomSummary;
    }
    return serializeChatRoom((room as any).toObject?.() ?? room);
}
