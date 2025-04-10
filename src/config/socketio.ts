import {Server} from "socket.io";
import http from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";

export function configureSocketIO(server: http.Server, redis: Redis) {
    const io = new Server(server, { cors: { origin: "*" } });

    // Redis Connection
    const pubClient = redis;
    const subClient = pubClient.duplicate();

    // Use Redis Adapter for Scaling WebSockets
    io.adapter(createAdapter(pubClient, subClient));

    return {io, pubClient, subClient};
}