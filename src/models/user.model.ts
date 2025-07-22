import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser {
    username: string;
    password?: string;
    email: string;
    lastLogin?: Date;
    personIRI?: string | null;
    organizationIRI?: string | null;
    isEmailVerified?: boolean;
    isRegistrationComplete?: boolean;

    // oauth2
    googleId?: string;
}

interface IUserMethods {
    comparePassword(password: string): Promise<boolean>;
}

export type UserModel = mongoose.Model<IUser, {}, IUserMethods>;

const userSchema = new mongoose.Schema<IUser, UserModel, IUserMethods>({
    username: { type: String, unique: true }, // not required
    email: { type: String, required: true },
    password: { type: String, default: null }, // not required for OAuth users
    lastLogin: { type: Date, default: null },
    personIRI: { type: String, unique: true },
    organizationIRI: { type: String },
    isEmailVerified: { type: Boolean, default: false },
    isRegistrationComplete: { type: Boolean, default: false },
    googleId: { type: String, unique: true, sparse: true },
});

// Pre-save Hook: Hash Password with Salt Before Storing
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    if (!this.password) {
        // If password is not set, skip hashing
        return next();
    }

    const salt = await bcrypt.genSalt(10); // Generate a salt with 10 rounds
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Password Comparison Method
userSchema.method('comparePassword', async function (password: string) {
    if (!this.password) {
        // If password is not set, return false
        return false;
    }
    return await bcrypt.compare(password, this.password);
});

export default mongoose.model<IUser, UserModel>("User", userSchema);