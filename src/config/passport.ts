import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcript from 'bcryptjs';
import { prisma } from '../lib/prisma.js'

const INVALID = "Email ou Password inválidos."

passport.use(
	new LocalStrategy(
		{ usernameField: 'email', passwordField: 'password' },
		async function (email, password, done) {
			try {
				const user = await prisma.user.findUnique({ where: { email: email } });
				if (!user || !user.password) return done(null, false, INVALID);

				const ok = bcript.compare(password, user.password);

				if (!ok) return done(null, false, INVALID);

				const { password: _omit, ...safeUser } = user;
				done(null, safeUser);

			} catch (error) {
				done(error);
			}
		}
	)
);

passport.serializeUser((user, done) => {
	done(null, user.id);
});

passport.deserializeUser(async (id: number, done)=>{
	try {
		const user = await prisma.user.findUnique({
			where: { id },
			omit: { password: true }
		});
		done(null, user ?? false);
	} catch (error) {
		done(error);
	}
})