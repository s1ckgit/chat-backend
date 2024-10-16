import { Router } from "express";
import jwt from 'jsonwebtoken'; 

import db from '../prisma/client';
import { hashPassword, verifyPassword } from "../utils/bcrypt";

const router = Router();

router.post('/register', async (req, res) => {
  const { login, password } = req.body;

  const hashedPassword = await hashPassword(password);

  try {
    const newUser = await db.user.create({
      data: {
        login,
        password: hashedPassword
      }
    })

    const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET ?? 'secretKey', {
      expiresIn: '24h'
    })

    console.log('Setting cookie:', token);
  
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400000
    })
    res.status(201).send();
    
  } catch(e) {
    res.status(400).json(e);
  }
})

router.post('/login', async (req, res) => {
  const { login, password } = req.body;

  const user = await db.user.findUnique({
    where: {
      login
    }
  })

  if(!user) {
    res.status(400).json({
      error: 'Ошибка авторизации. Неверный логин или пароль'
    })
    return;
  }

  const isPasswordCorrect = await verifyPassword(password, user.password);

  if(!isPasswordCorrect) {
    res.status(400).json({
      error: 'Ошибка авторизации. Неверный логин или пароль'
    })
    return;
  }

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET ?? 'secretKey', {
    expiresIn: '24h'
  })

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400000
  })

  res.status(200).json({ message: 'Успешный вход' });
  return;
})

export default router;
