import type { Request, Response, NextFunction } from "express";

export function preventGuestMutation(req: Request, res: Response, next: NextFunction) {
	const user = req.user as { isGuest?: boolean; username?: string } | undefined;

	if (user?.isGuest || user?.username === "guest") {
		const targetUsername = req.body?.username;
		const targetPassword = req.body?.password;

		if (targetUsername !== undefined || targetPassword !== undefined) {
			return res.status(403).json({
				error: "O utilizador convidado (guest) não tem permissão para alterar o username nem a palavra-passe."
			});
		}
	}

	next();
}
