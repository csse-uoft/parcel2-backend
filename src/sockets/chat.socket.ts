import {Server, Socket} from "socket.io";
import Redis from "ioredis";
import jwt, {JwtPayload} from "jsonwebtoken";
import Message from "../models/message.model";

export default (io: Server, pubClient: Redis, subClient: Redis) => {
    // WebSocket Authentication
    io.use((socket: Socket, next) => {
        try {
            const token = socket.handshake.query.token as string;
            if (!token) throw new Error("Authentication required");

            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
            (socket as any).user = decoded;
            next();
        } catch (err: any) {
            next(err);
        }
    });

// **WebSocket Events**
    io.on("connection", (socket: Socket) => {
        const user = (socket as any).user;
        console.log(`⚡ User connected: ${user.username}`);

        socket.on("join room", async ({roomName}: { roomName: string }) => {
            socket.join(roomName);
            console.log(`${user.username} joined room: ${roomName}`);

            const cachedMessages = await pubClient.lrange(`chat:${roomName}`, 0, -1);
            if (cachedMessages.length > 0) {
                // @ts-ignore
                socket.emit("chat history", cachedMessages.map(JSON.parse));
            } else {
                const messages = await Message.find({room: roomName}).sort({timestamp: -1}).limit(50);
                socket.emit("chat history", messages);
            }
        });

        socket.on("chat message", async ({room, text}: { room: string; text: string }) => {
            const message = {sender: user.username, text, room, timestamp: new Date()};

            // **Publish Message to Redis Pub/Sub**
            pubClient.publish("chat_room", JSON.stringify({room, message}));

            // **Store in Redis Cache (Keep Last 50 Messages)**
            await pubClient.lpush(`chat:${room}`, JSON.stringify(message));
            await pubClient.ltrim(`chat:${room}`, 0, 49);
        });

        socket.on("file message", async ({room, fileUrl}: { room: string; fileUrl: string }) => {
            const message = {sender: user.username, fileUrl, room, timestamp: new Date()};

            // **Publish File Message to Redis**
            pubClient.publish("chat_room", JSON.stringify({room, message}));

            // **Store in Redis Cache**
            await pubClient.lpush(`chat:${room}`, JSON.stringify(message));
            await pubClient.ltrim(`chat:${room}`, 0, 49);
        });

        socket.on("disconnect", () => {
            console.log(`❌ ${user.username} disconnected`);
        });
    });

// **Subscribe to Redis for WebSocket Synchronization**
    subClient.subscribe("chat_room");
    subClient.on("message", (channel, message) => {
        if (channel === "chat_room") {
            const {room, message: msg} = JSON.parse(message);
            io.to(room).emit("chat message", msg);
        }
    });

};
