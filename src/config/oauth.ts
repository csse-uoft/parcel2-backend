import { configs } from "./configs";

export const oauthConfig = {
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        // This is the URL where Google will redirect after authentication
        callbackURL: process.env.GOOGLE_CALLBACK_URL || configs.backendAddress + "/api/auth/google/callback",
    }
}

export async function testOauthConfig() {
    if (!oauthConfig.google.clientId || !oauthConfig.google.clientSecret) {
        throw new Error("Google OAuth configuration is incomplete. Please check your environment variables.");
    }
    console.log("✅ Google OAuth configuration is valid.");
}