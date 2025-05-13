import dotenv from "dotenv";
dotenv.config();
dotenv.config({path: ['../.env', '../.env.local', '.env', '.env.local']});

import express from "express";
import cors from 'cors';
import cookieParser from "cookie-parser";
import http from "http";
import logger from "morgan";
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
    app.use(logger('dev'));
    const server = http.createServer(app);
    const {io, pubClient, subClient} = configureSocketIO(server, redisClient);

    // Middleware
    app.set("trust proxy", 1);
    app.use(cors({
        origin: [process.env.FRONTEND_URL || "http://localhost:3000"],
        credentials: true,
    }));
    app.use(express.json());
    app.use(cookieParser());

    // Routes
    app.use("/api/auth", authRoutes);
    configureUploads(app);

    // WebSocket Handling
    chatSocket(io, pubClient, subClient);

    // Start Server
    server.listen(3005, () => console.log("🚀 Server running on port 3005"));
}

init().catch(console.error);