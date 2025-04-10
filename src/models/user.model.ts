import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser {
    username: string;
    password: string;
    email: string;
    lastLogin?: Date;
}

interface IUserMethods {
    comparePassword(password: string): Promise<boolean>;
}

export type UserModel = mongoose.Model<IUser, {}, IUserMethods>;

const userSchema = new mongoose.Schema<IUser, UserModel, IUserMethods>({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    email: { type: String, required: true },
    lastLogin: { type: Date, default: null },
});

// Pre-save Hook: Hash Password with Salt Before Storing
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    const salt = await bcrypt.genSalt(10); // Generate a salt with 10 rounds
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Password Comparison Method
userSchema.method('comparePassword', async function (password: string) {
    return await bcrypt.compare(password, this.password);
});

export default mongoose.model<IUser, UserModel>("User", userSchema);