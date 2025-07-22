import passport from 'passport';
// @ts-ignore
import GoogleOIDCStrategy from 'passport-google-oidc';
import { oauthConfig } from "../../config/oauth";
import UserModel from "../../models/user.model";
import { Person } from "../../models/person.model";

passport.use(new GoogleOIDCStrategy(
    {
        clientID: oauthConfig.google.clientId,
        clientSecret: oauthConfig.google.clientSecret,
        callbackURL: oauthConfig.google.callbackURL,
        scope: ['openid', 'email', 'profile'],
    },
    async (issuer: any, profile: any, done: (err: unknown, arg1?: any) => any) => {
        try {
            console.log('Google profile received:', profile);
            const user = await findOrCreateUserByGoogleProfile(profile);
            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }
));

// passport.serializeUser((user: any, done) => {
//     done(null, user._id);
// });
//
// passport.deserializeUser(async (id: string, done) => {
//     const user = await UserModel.findById(id);
//     done(null, user);
// });


export async function findOrCreateUserByGoogleProfile(profile: any) {
    // Extract relevant user info from Google profile
    const { id, emails, displayName, name } = profile;
    const email = emails[0].value;

    // Check if user already exists in the database
    let user = await UserModel.findOne({ googleId: id });
    const person = Person.create({
        fullName: displayName,
        firstName: name.givenName,
        lastName: name.familyName,
    })
    await person.save();

    if (!user) {
        // Create a new user if not found
        user = await UserModel.create({
            googleId: id,
            email,
            password: null, // No password for OAuth users
            name: displayName,
            personIRI: person.iri,
            isEmailVerified: true, // Google profile email is verified
        });
    }

    return user;
}