import Redis from "ioredis";

export let redis: Redis;

export async function configureRedis(): Promise<Redis> {
    if (!process.env.REDIS_URL) {
        throw new Error('Invalid/Missing environment variable: "REDIS_URL"');
    }
    return new Promise((resolve, reject) => {
        redis = new Redis(process.env.REDIS_URL as string);
        redis.on("error", (err) => {
            console.error("❌ Redis connection error:", err);
            reject(err);
        });
        redis.on("ready", () => {
            console.log("✅ Redis connected");
            resolve(redis);
        });
    });
}
