import nodemailer from 'nodemailer';
import {getVerificationTemplate} from './template';
import { mailerConfig } from '../../config/configs';

const transporter = nodemailer.createTransport(mailerConfig.mailServer);

export const sendVerificationMail = async (email: string, token: string) => {
  const {html, text} = getVerificationTemplate(email, token);
  const mailOptions = {
    from: mailerConfig.from,
    to: email,
    subject: 'Account Verification',
    html,
    text,
  };
  await new Promise((resole, reject) => {
    console.log("http://localhost:3005/register/" + token)
    transporter.sendMail(mailOptions, function (err: any) {
      if (err) {
        reject(err);
      } else {
        console.log("email sent");
        resole(undefined);
      }
    });
  });
};

