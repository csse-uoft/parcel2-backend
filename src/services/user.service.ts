import User, { IUser, UserModel } from "../models/user.model";
import { ServiceError } from "../utils/errors";
import { Organization } from "../models";
import { normalizeRoles, UserRole } from "../constants/roles";

export const getUserById = async (userId: string) => {
    return await User.findById(userId).select("-password");
};

export async function createUser(userData: IUser) {
    const existingUser = await User.findOne({ username: userData.username });
    if (existingUser) {
        throw new ServiceError("User already exists");
    }

    // check if email exists
    if (await User.findOne({ email: userData.email })) {
        throw new ServiceError("Email already exists");
    }

    const roles = normalizeRoles((userData.roles as UserRole[]) ?? undefined);
    const newUser = new User({
        ...userData,
        roles,
    });
    await newUser.save();

    return newUser;
}

export async function getUserOrganization(userId: string): Promise<Organization> {
    const user = await User.findById(userId);

    if (!user || !user.organizationIRI) {
        throw new ServiceError("Organization not found (no organizationIRI)", 404)
    }

    const organization = await Organization.findByIri<Organization>(user.organizationIRI);
    if (!organization) {
        throw new ServiceError("Organization not found (no organization for IRI)", 404)
    }
    return organization;
}