import { Router } from "express";
import { passport } from "../config/passport.js";
import { ensureAuth } from "../middleware/ensureAuth.js";
import registerValidator from "../middleware/registerValidator.js";
import { validationResult } from "express-validator";
import loginValidator from "../middleware/loginValidator.js";
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