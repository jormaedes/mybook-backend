import { Router } from "express";
import { passport } from "../config/passport.js";
import { ensureAuth } from "../middleware/ensureAuth.js";

const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login',
	passport.authenticate('local'), (req, res) => {
		res.json({user: req.user});
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
authRouter.get('/me', ensureAuth, (req, res, next)=>{
	res.json({ user: req.user });
});

export default authRouter;