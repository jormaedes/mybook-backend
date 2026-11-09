import { body } from "express-validator";

const registerValidator = [
	body('username')
		.trim()
		.notEmpty()
		.withMessage('Erro: Username não pode ser vazio'),

	body('email')
		.trim()
		.notEmpty()
		.withMessage('Erro: Email não pode ser vazio')
		.isEmail()
		.withMessage('Email inválido'),

	body('password')
		.trim()
		.notEmpty()
		.withMessage('A palavra-passe é obrigatória')
];

export default registerValidator;