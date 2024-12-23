import { Router } from "express";
import jwt from 'jsonwebtoken'; 

import db from '../prisma/client';
import { hashPassword, verifyPassword } from "../utils/bcrypt";

const router = Router();

router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    if(!refreshToken) {
      res.status(401).json({
        error: 'Токен обновления отсутствует',
        reason: 'unauthorized'
      })
      return
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET ?? 'refreshSecretKey') as { id: string };
    const user = await db.user.findUnique({
      where: { id: decoded.id },
    });

    if (user && user.refreshToken === refreshToken) {
      const newAccessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET ?? 'secretKey', { expiresIn: '1h' });
      const newRefreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET ?? 'refreshSecretKey', { expiresIn: '365d' });

      await db.user.update({
        where: { id: user.id },
        data: { refreshToken: newRefreshToken },
      });

      res.cookie('accessToken', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000,
      });
      
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000 * 8760
      });

      res.status(200).json({ message: 'Токены обновлены' });
    } else {
      res.status(401).json({ error: 'Ошибка авторизации. Неверный токен.', reason: 'unauthorized' });
    }
  } catch (error) {
    console.error(error);
    res.status(401).json({ error: 'Ошибка авторизации. Неверный токен.' });
  }
})

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

    const accessToken = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET ?? 'secretKey', {
      expiresIn: '1h'
    })

    const refreshToken = jwt.sign({ id: newUser.id }, process.env.JWT_REFRESH_SECRET ?? 'refreshSecretKey', {
      expiresIn: '365d'
    })

    await db.user.update({
      where: {
        id: newUser.id
      },
      data: {
        refreshToken
      }
    })

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000 * 8760
    })
  
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000
    })

    res.status(201).send({
      id: newUser.id
    });
    
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

  const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET ?? 'secretKey', {
    expiresIn: '1h'
  })

  const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET ?? 'refreshSecretKey', {
    expiresIn: '365d'
  })

  await db.user.update({
    where: {
      id: user.id
    },
    data: {
      refreshToken
    }
  })

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000 * 8760
  })

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000
  })

  res.status(200).json({ message: 'Успешный вход' });
  return;
})

router.post('/logout', async (req, res) => {
  try {
    const { accessToken } = req.cookies;

    const { id } = jwt.verify(accessToken, process.env.JWT_SECRET ?? 'secretKey') as { id: string };

    await db.user.update({
      where: {
        id
      },
      data: {
        refreshToken: null
      }
    })

    res.clearCookie('accessToken', {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    })
    res.clearCookie('refreshToken', {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    })

    res.status(200).send()
  } catch(e) {
    res.status(500).json({
      error: e
    })
  }
  
})

export default router;
