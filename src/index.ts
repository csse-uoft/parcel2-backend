import dotenv from "dotenv";
dotenv.config();
dotenv.config({path: ['../.env', '../.env.local', '.env', '.env.local']});

import express from "express";
import cookieParser from "cookie-parser";
import http from "http";
import authRoutes from "./routes/auth.routes";
import chatSocket from "./sockets/chat.socket";
import {connectMongoDB} from "./config/mongodb";
import {configureUploads} from "./config/uploads";
import {configureSocketIO} from "./config/socketio";
import {configureStardog} from "./config/stardog";
import {configureRedis} from "./config/redis";
import {initAdminUser} from "./config/init";

async function init() {
    // Database Connection
    const redisClient = await configureRedis();
    await connectMongoDB();
    await configureStardog();
    await initAdminUser();

    const app = express();
    const server = http.createServer(app);
    const {io, pubClient, subClient} = configureSocketIO(server, redisClient);

    // Middleware
    app.set("trust proxy", true)
    app.use(express.json());
    app.use(cookieParser());

    // Routes
    app.use("/api/auth", authRoutes);
    configureUploads(app);

    // WebSocket Handling
    chatSocket(io, pubClient, subClient);

    // Start Server
    server.listen(3005, () => console.log("🚀 Server running on port 3000"));
}

init().catch(console.error);