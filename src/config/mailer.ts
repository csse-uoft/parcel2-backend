import { configs } from "./configs";


export async function testMailer() {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport(configs.mailerConfig.mailServer);

    try {
        await transporter.verify();
        console.log('✅ Mailer configuration is valid.');
    } catch (error) {
        console.error('❌ Mailer configuration error:', error);
        // throw new Error('Invalid mailer configuration');
    }
}
