import User, {IUser} from "../models/user.model";
import {ServiceError} from "../utils/errors";

export const getUserById = async (userId: string) => {
    return await User.findById(userId).select("-password");
};

export async function createUser(userData: IUser): Promise<IUser> {
    const existingUser = await User.findOne({ username: userData.username });
    if (existingUser) {
        throw new ServiceError("User already exists");
    }

    // check if email exists
    if (await User.findOne({ email: userData.email })) {
        throw new ServiceError("Email already exists");
    }

    const newUser = new User(userData);
    await newUser.save();

    return newUser;
}

