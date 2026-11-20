import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcript from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { Strategy as GitHubStrategy, type Profile } from "passport-github2";

const INVALID = { message: "Email ou Password inválidos." };

passport.use(
	new LocalStrategy(
		{ usernameField: 'email', passwordField: 'password' },
		async function (email, password, done) {
			try {
				const user = await prisma.user.findUnique({ where: { email: email } });
				if (!user || !user.password) return done(null, false, INVALID);

				const ok = await bcript.compare(password, user.password);

				if (!ok) return done(null, false, INVALID);

				const { password: _omit, ...safeUser } = user;
				done(null, safeUser);

			} catch (error) {
				done(error);
			}
		}
	)
);

passport.use(
	new GitHubStrategy(
		{
			clientID: process.env.GITHUB_CLIENT_ID!,
			clientSecret: process.env.GITHUB_CLIENT_SECRET!,
			callbackURL: process.env.GITHUB_CALLBACK_URL!,
		},
		async (
			_accessToken: string,
			_refreshToken: string,
			profile: Profile,
			done: (err: unknown, user?: Express.User | false) => void
		) => {
			try {
				const githubId = profile.id;

				// 1. Já entrou antes com o GitHub? Devolve esse utilizador.
				const existing = await prisma.user.findUnique({
					where: { githubId },
					omit: { password: true },
				});
				if (existing) return done(null, existing);

				// 2. Username: se já estiver ocupado, acrescenta o id do GitHub
				const base = (profile.username ?? `user${githubId}`).toLowerCase();
				const taken = await prisma.user.findUnique({ where: { username: base } });
				const username = taken ? `${base}-${githubId}` : base;

				// 3. Email: pode vir vazio (privado) ou já existir numa conta local.
				//    Nos dois casos usa um email de substituição, único por conta.
				let email = profile.emails?.[0]?.value?.toLowerCase();
				if (!email || (await prisma.user.findUnique({ where: { email } }))) {
					email = `${githubId}@users.noreply.github.com`;
				}

				// 4. Criar o utilizador (sem password)
				const user = await prisma.user.create({
					data: {
						githubId,
						username,
						email,
						password: null,
						avatarUrl: profile.photos?.[0]?.value,
					},
					omit: { password: true },
				});

				done(null, user);
			} catch (err) {
				done(err);
			}
		}
	)
);

passport.serializeUser((user, done) => {
	done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
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

export { passport }