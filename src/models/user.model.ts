import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { DEFAULT_USER_ROLES, UserRole, normalizeRoles, hasRole } from "../constants/roles";

export interface IOpportunityFavourite {
    opportunityIri: string;
    addedAt?: Date;
}

export interface IUser {
    username: string;
    password?: string;
    email: string;
    lastLogin?: Date;
    personIRI?: string | null;
    organizationIRI?: string | null;
    isEmailVerified?: boolean;
    isRegistrationComplete?: boolean;
    roles?: UserRole[];
    passwordResetToken?: string | null;
    passwordResetExpires?: Date | null;

    // oauth2
    googleId?: string;
    opportunityFavourites?: IOpportunityFavourite[];
}

interface IUserMethods {
    comparePassword(password: string): Promise<boolean>;
    hasRole(role: UserRole | UserRole[]): boolean;
}

export type UserModel = mongoose.Model<IUser, {}, IUserMethods>;

const opportunityFavouriteSchema = new mongoose.Schema<IOpportunityFavourite>(
    {
        opportunityIri: { type: String, required: true },
        addedAt: { type: Date, default: Date.now },
    },
    { _id: false },
);

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
    roles: {
        type: [String],
        enum: Object.values(UserRole),
        default: DEFAULT_USER_ROLES,
        set: normalizeRoles,
    },
    passwordResetToken: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null },
    opportunityFavourites: { type: [opportunityFavouriteSchema], default: [] },
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

// Pre-save Hook: Clean up personIRI if empty string or null
userSchema.pre("save", function (next) {
    if (this.isModified("personIRI") && (this.personIRI === null || this.personIRI === "")) {
        this.personIRI = undefined;
    }
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

userSchema.method('hasRole', function (role: UserRole | UserRole[]) {
    const current = normalizeRoles(this.roles as UserRole[]);
    return hasRole(current, role as UserRole | UserRole[]);
});

export default mongoose.model<IUser, UserModel>("User", userSchema);