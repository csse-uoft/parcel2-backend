import { configs } from "./config/configs"; // Load environment variables
import express from "express";
import cors from 'cors';
import cookieParser from "cookie-parser";
import http from "http";
import logger from "morgan";
import authRoutes from "./routes/auth.routes";
import usersRoutes from "./routes/user.routes";
import organizationRoutes from "./routes/organization.routes";
import taxonomyRoutes from "./routes/taxonomy.routes";
import uploadRoutes from "./routes/uploads.routes";
import opportunitiesRoute from "./routes/opportunities.route";
import chatSocket from "./sockets/chat.socket";
import { connectMongoDB } from "./config/mongodb";
import { configureUploads } from "./config/uploads";
import { configureSocketIO } from "./config/socketio";
import { configureStardog } from "./config/stardog";
import { configureRedis } from "./config/redis";
import { initAdminUser } from "./config/init";
import { errorHandler } from "./middleware/error.middleware";
import { testMailer } from "./config/mailer";
import { testOauthConfig } from "./config/oauth";
import session from "express-session";
import passport from 'passport';
import "./services/auth/google";
import { initTaxonomy } from "./taxonomy";
import { UPLOADS_DIR, ensureTmpDirs } from "./config/storage";

async function init() {
    // Configs
    await testOauthConfig();
    await testMailer();
    ensureTmpDirs();

    // Database Connection
    const redisClient = await configureRedis();
    await connectMongoDB();
    await configureStardog();
    await initAdminUser();
    await initTaxonomy();

    const app = express();
    app.use(logger('dev'));
    const server = http.createServer(app);
    const { io, pubClient, subClient } = configureSocketIO(server, redisClient);

    // Middleware
    app.set("trust proxy", 1);
    app.use(cors({
        origin: [process.env.FRONTEND_URL || "http://localhost:3000"],
        credentials: true,
    }));
    app.use(session({
        secret: process.env.SESSION_SECRET!,
        resave: false,
        saveUninitialized: false,
    }));
    app.use(express.json());
    app.use(cookieParser());
    app.use(passport.initialize());
    app.use(passport.session());

    // Routes
    app.use("/api/auth", authRoutes);
    app.use("/api", usersRoutes);
    app.use("/api", organizationRoutes);
    app.use("/taxonomy", taxonomyRoutes);
    app.use("/api/uploads", uploadRoutes);
    app.use("/api/opportunities", opportunitiesRoute);

    // Serve static files from the "uploads" directory
    app.use('/uploads', express.static(UPLOADS_DIR));

    // Configure error handling
    app.use(errorHandler);

    configureUploads(app);

    // WebSocket Handling
    chatSocket(io, pubClient, subClient);

    // Start Server;
    server.listen(configs.PORT, () => console.log("🚀 Server running on port " + configs.PORT));
}

init().catch(console.error);