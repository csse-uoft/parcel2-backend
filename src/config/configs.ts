import dotenv from "dotenv";
import path from "path";

dotenv.config();

// use __dirname
for (const file of ['.env.local', '.env']) {
    dotenv.config({ path: path.resolve(__dirname, '../../', file) });
}

// Use cwd
for (const file of ['.env.local', '.env']) {
    dotenv.config({ path: path.resolve(process.cwd(), file) });
}

const isProduction = process.env.NODE_ENV === 'production';

export const port = process.env.PORT && Number(process.env.PORT) || 3105;
export const frontendConfig = {
    address: isProduction ? 'https://www.connectbuildnow.org' : 'http://localhost:3000'
};
export const mailerConfig = {
    from: process.env.MAIL_SENDER || 'no-reply@example.com',
    mailServer: {
        host: process.env.MAIL_SERVER || 'example.com',
        port: Number(process.env.MAIL_PORT) || 25,
        auth: {
            user: process.env.MAIL_USERNAME || 'username@example.com',
            pass: process.env.MAIL_PASSWORD || 'password'
        },
        secure: true,  // STARTTLS
        // forceTLS: true,
    },
};

export const configs = {
    frontendConfig,
    mailerConfig,
    port,

    JWT_SECRET: process.env.JWT_SECRET || "jwtsecret_placeholder",
    PORT: port,
    backendAddress: process.env.BACKEND_ADDRESS || (isProduction ? 'https://www.connectbuildnow.com' : `http://localhost:${port}`),
}
