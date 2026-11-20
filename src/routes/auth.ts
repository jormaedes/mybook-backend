import { Router } from "express";
import { passport } from "../config/passport.js";
import { ensureAuth } from "../middleware/ensureAuth.js";
import registerValidator from "../middleware/registerValidator.js";
import { validationResult } from "express-validator";
import loginValidator from "../middleware/loginValidator.js";
import { preventGuestMutation } from "../middleware/preventGuestMutation.js";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import type { Request, Response, NextFunction } from "express";

const authRouter = Router();

const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:3000";

// Inicia o fluxo: redireciona o browser para o GitHub
// /api/auth/github
authRouter.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] })
);

// O GitHub volta aqui com o código
// /api/auth/github/callback
authRouter.get(
  "/github/callback",
  passport.authenticate("github", {
    failureRedirect: `${CLIENT_URL}/login?error=github`,
  }),
  (_req, res) => {
    res.redirect(CLIENT_URL); // sessão já aberta; o frontend chama /me
  }
);

// POST /api/auth/login
authRouter.post('/login', loginValidator, (req: Request, res: Response, next: NextFunction) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({
			errors: errors.array()
		});
	}
	next();
},
	passport.authenticate('local'), (req: Request, res: Response) => {
		res.json({ user: req.user });
	}
);

// POST /api/auth/guest
authRouter.post('/guest', async (req: Request, res: Response, next: NextFunction) => {
	try {
		let guestUser = await prisma.user.findUnique({
			where: { username: 'guest' },
			omit: { password: true }
		});

		if (!guestUser) {
			const saltRounds = Number(process.env.PASSWORD_HASH_NUMBER) || 10;
			const defaultHash = await bcrypt.hash("password123", saltRounds);
			guestUser = await prisma.user.create({
				data: {
					username: 'guest',
					email: 'guest@odinbook.dev',
					password: defaultHash,
					isGuest: true,
					bio: 'Conta de demonstração para convidados.',
					avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
				},
				omit: { password: true }
			});
		}

		req.login(guestUser, (err) => {
			if (err) return next(err);
			return res.json({ user: guestUser });
		});
	} catch (error) {
		next(error);
	}
});

// POST /api/auth/logout
authRouter.post('/logout', (req, res, next) => {
	req.logout((err) => {
		if (err) next(err);
		req.session.destroy(() => {
			res.clearCookie('connect.sid');
			res.status(204).end();
		});
	});
});

// POST /api/auth/me
authRouter.get('/me', ensureAuth, (req, res, next) => {
	res.json({ user: req.user });
});

// POST /api/auth/register
authRouter.post('/register', registerValidator, async (req: Request, res: Response, next: NextFunction) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({
			errors: errors.array()
		});
	}

	const { username, email, password } = req.body;
	if (username.toLowerCase() === 'guest') {
		return res.status(400).json({
			errors: [{ msg: "O nome 'guest' é reservado para a conta de demonstração." }]
		});
	}
	try {
		const saltRounds = Number(process.env.PASSWORD_HASH_NUMBER) || 10;
		const hash = await bcrypt.hash(password, saltRounds);
		const user = await prisma.user.create({
			data: {
				username: username,
				password: hash,
				email: email
			},
			omit: { password: true }
		});
		req.login(user, (err) => {
			if (err) return next(err);
			return res.status(201).json({ user });
		});
	} catch (error) {
		if ((error as { code?: string }).code === 'P2002') {
			return res
				.status(409)
				.json({ error: "Username ou email já estão em uso." });
		}
		next(error);
	}
});

export default authRouter;