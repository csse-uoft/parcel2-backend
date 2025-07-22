import mongoose from "mongoose";

export const connectMongoDB = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error('Invalid/Missing environment variable: "MONGO_URI"')
    }
    try {
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log("✅ MongoDB connected");
    } catch (error) {
        console.error("❌ MongoDB connection error:", error);
    }
};

export async function clearMongoDB() {
    try {
        await mongoose.connection.dropDatabase();
        console.log("✅ MongoDB database cleared");
    } catch (error) {
        console.error("❌ Error clearing MongoDB database:", error);
    }
}