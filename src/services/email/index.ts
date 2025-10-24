import nodemailer from 'nodemailer';
import { getOrganizationInvitationTemplate, getVerificationTemplate } from './template';
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
  await new Promise((resolve, reject) => {
    console.log("http://localhost:3105/register/" + token)
    transporter.sendMail(mailOptions, function (err: any) {
      if (err) {
        reject(err);
      } else {
        console.log("email sent");
        resolve(undefined);
      }
    });
  });
};

interface InvitationMailOptions {
  email: string;
  temporaryPassword: string;
  organizationName?: string | null;
}

export const sendOrganizationInvitationMail = async ({ email, temporaryPassword, organizationName }: InvitationMailOptions) => {
  const { html, text } = getOrganizationInvitationTemplate({ email, temporaryPassword, organizationName });
  const mailOptions = {
    from: mailerConfig.from,
    to: email,
    subject: organizationName ? `${organizationName} invited you to Parcel` : 'Parcel account invitation',
    html,
    text,
  };

  await new Promise<void>((resolve, reject) => {
    transporter.sendMail(mailOptions, (err: any) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
};

