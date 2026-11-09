import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import { passport } from './config/passport.js';
import session from 'express-session';
import authRouter from './routes/auth.js';

const isProd = process.env.NODE_ENV === "production";

const app = express();

app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  }
}));

app.use(passport.initialize());
app.use(passport.session());


app.get('/api/health', (req, res) => {
  res.json({ message: 'ok' });
});

app.use('/api/auth', authRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err.status === 401) {
    return res.status(401).json({
      message: 'Email ou password incorretos'
    });
  }
  
  res.status(500).json({ error: "Erro interno do servidor." });
};

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API rodando na porta: ${PORT}`);
});