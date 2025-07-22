import "../../../config/configs";


import { clearStardogDatabase, configureStardog } from "../../../config/stardog";
import { clearMongoDB, connectMongoDB } from "../../../config/mongodb";

export const initTests = async () => {
    await configureStardog();
    await clearStardogDatabase();
    connectMongoDB();
    await clearMongoDB();
};
