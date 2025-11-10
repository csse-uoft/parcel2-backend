import { Server, Socket } from "socket.io";
import Redis from "ioredis";
import jwt, { JwtPayload } from "jsonwebtoken";

import User from "../models/user.model";
import { normalizeRoles } from "../constants/roles";
import { RequestUser } from "../middleware/auth.middleware";
import {
    CHAT_CHANNEL,
    assertCanAccessChatRoom,
    findChatRoomById,
    loadMessages,
    recordChatMessage,
} from "../services/chat.service";
import { ServiceError } from "../utils/errors";

function readHandshakeToken(socket: Socket): string | null {
    const authToken = socket.handshake.auth?.token;
    if (authToken) return String(authToken);
    const queryToken = socket.handshake.query?.token;
    if (typeof queryToken === "string") return queryToken;
    if (Array.isArray(queryToken) && queryToken.length > 0) return queryToken[0];
    return null;
}

function emitSocketError(socket: Socket, error: unknown) {
    if (error instanceof ServiceError) {
        socket.emit("chat error", { message: error.message });
        return;
    }
    if (error instanceof Error) {
        socket.emit("chat error", { message: error.message });
    } else {
        socket.emit("chat error", { message: "Unexpected error" });
    }
}

export default (io: Server, pubClient: Redis, subClient: Redis) => {
    io.use(async (socket, next) => {
        try {
            const token = readHandshakeToken(socket);
            if (!token) {
                throw new Error("Authentication required");
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload & {
                userId: string;
                username: string;
            };

            if (!decoded?.userId) {
                throw new Error("Invalid token");
            }

            const userDoc = await User.findById(decoded.userId);
            if (!userDoc) {
                throw new Error("User not found");
            }

            const socketUser: RequestUser = {
                id: userDoc._id.toString(),
                username: userDoc.username,
                roles: normalizeRoles(userDoc.roles as any),
                organizationIRI: userDoc.organizationIRI ?? null,
            };

            socket.data.user = socketUser;
            next();
        } catch (err) {
            next(err as Error);
        }
    });

    io.on("connection", (socket: Socket) => {
        const user = socket.data.user as RequestUser;
        const username = user?.username ?? "unknown";
        console.log(`⚡ User connected: ${username}`);

        socket.on("join room", async ({ roomId, room }: { roomId?: string; room?: string }) => {
            const targetRoom = roomId ?? room;
            if (!targetRoom) {
                emitSocketError(socket, new ServiceError("roomId is required", 400));
                return;
            }

            try {
                const chatRoom = await findChatRoomById(targetRoom);
                assertCanAccessChatRoom(chatRoom, user);
                socket.join(targetRoom);

                const history = await loadMessages({ room: chatRoom, redisClient: pubClient });
                socket.emit("chat history", history);
                console.log(`${username} joined room: ${targetRoom}`);
            } catch (error) {
                emitSocketError(socket, error);
            }
        });

        socket.on("chat message", async (payload: { roomId?: string; room?: string; text: string }) => {
            const targetRoom = payload.roomId ?? payload.room;
            if (!targetRoom) {
                emitSocketError(socket, new ServiceError("roomId is required", 400));
                return;
            }
            try {
                const chatRoom = await findChatRoomById(targetRoom);
                assertCanAccessChatRoom(chatRoom, user);
                await recordChatMessage({
                    room: chatRoom,
                    sender: user,
                    text: payload.text,
                    redisClient: pubClient,
                });
            } catch (error) {
                emitSocketError(socket, error);
            }
        });

        socket.on("file message", async (payload: { roomId?: string; room?: string; fileUrl: string }) => {
            const targetRoom = payload.roomId ?? payload.room;
            if (!targetRoom) {
                emitSocketError(socket, new ServiceError("roomId is required", 400));
                return;
            }
            try {
                const chatRoom = await findChatRoomById(targetRoom);
                assertCanAccessChatRoom(chatRoom, user);
                await recordChatMessage({
                    room: chatRoom,
                    sender: user,
                    fileUrl: payload.fileUrl,
                    redisClient: pubClient,
                });
            } catch (error) {
                emitSocketError(socket, error);
            }
        });

        socket.on("disconnect", () => {
            console.log(`❌ ${username} disconnected`);
        });
    });

    subClient.subscribe(CHAT_CHANNEL);
    subClient.on("message", (channel, rawMessage) => {
        if (channel !== CHAT_CHANNEL) return;
        try {
            const { room, message } = JSON.parse(rawMessage);
            io.to(room).emit("chat message", message);
        } catch (error) {
            console.error("Failed to broadcast chat message", error);
        }
    });
};
