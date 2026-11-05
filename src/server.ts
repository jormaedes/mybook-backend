import express, { type Request, type Response } from 'express';
import cors from 'cors';


const app = express();

app.use(cors());

const PORT = process.env.PORT || 4000;

app.get('/api/health', (req: Request, res: Response) => {
	res.json({ message: 'ok' });
});

app.post('/login', 
  passport.authenticate('local', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

app.listen(PORT, () => {
	console.log(`API rodando na porta: ${PORT}`);
});