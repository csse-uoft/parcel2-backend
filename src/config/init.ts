import User from "../models/user.model";
import {createUser} from "../services/user.service";
import * as crypto from "node:crypto";

const generatePassword = (
    length = 20,
    characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz,./?~!@-#$'
) =>
    Array.from(crypto.randomFillSync(new Uint32Array(length)))
        .map((x) => characters[x % characters.length])
        .join('')

export const initAdminUser = async () => {
    const adminUser = await User.findOne({ username: "admin" });

    // Create the admin user if it doesn't exist or if never logged in
    if (!adminUser || adminUser?.lastLogin == null) {
        if (adminUser) {
            await User.deleteOne({ username: "admin" });
        }
        const randomPassword = generatePassword(20);
        await createUser({
            username: "admin",
            email: "admin@parcel.com",
            password: randomPassword,
        })
        console.log("✅ Admin user created with password:", randomPassword);
    } else {
        console.log("✅ Admin user already exists");
    }
};
