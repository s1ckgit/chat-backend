import { Router } from "express";
import jwt from 'jsonwebtoken'; 

import db from '../prisma/client';
import { hashPassword, verifyPassword } from "../utils/bcrypt";
import { clearTokensForUser, generateTokensForUser, getDecodedOAuthJwtGoogle, reuploadPhotoToCloudinary } from "../utils/auth";
import { AppError, wrapUnknowErrorIntoAppErrorInstance } from "../utils/errors";

const router = Router();

router.post('/refresh-token', async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    if(!refreshToken) {
      throw new AppError('Токен обновления отсутствует', 401)
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET ?? 'refreshSecretKey') as { id: string };
    const user = await db.user.findUnique({
      where: { id: decoded.id },
    });

    if (user && user.refreshToken === refreshToken) {
      await generateTokensForUser(user.id, res);

      res.status(200).json({ message: 'Токены обновлены' });
    } else {
      throw new AppError('Ошибка авторизации. Неверный токен обновления.', 401)
    }
  } catch (error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error)
    next(wrappedError)
  }
})

router.post('/register', async (req, res, next) => {
  const { login, password } = req.body;

  const hashedPassword = await hashPassword(password);

  try {
    const newUser = await db.user.create({
      data: {
        login,
        password: hashedPassword
      }
    })
  
    await generateTokensForUser(newUser.id, res)
  
    res.status(201).send({
      id: newUser.id
    });
  } catch (error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error)
    next(wrappedError)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const { login, password } = req.body;

    const user = await db.user.findUnique({
      where: {
        login
      }
    })

    if(!user) {
      throw new AppError('Ошибка авторизации. Неверный логин или пароль', 400)
    }

    const isPasswordCorrect = await verifyPassword(password, user.password!);

    if(!isPasswordCorrect) {
      throw new AppError('Ошибка авторизации. Неверный логин или пароль', 400)
    }

    await generateTokensForUser(user.id, res)

    res.status(200).json({ id: user.id });
  } catch(error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error);
    next(wrappedError)
  }
})

router.post('/telegram_auth', async (req, res, next) => {
  try {
    const data = req.body;
    const { id, username, photo_url } = data;

    const userId = String(id);

    let user = await db.user.findUnique({
      where: {
        id: userId
      }
    })

    if(!user) {
      user = await db.user.create({
        data: {
          id: userId,
          login: username
        }
      })

      if(photo_url) {
        await reuploadPhotoToCloudinary(photo_url, user.id)
      }
    }

    await generateTokensForUser(user.id, res)
  
    res.status(200).json({ id: user.id });
    return;
  } catch(error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error)
    next(wrappedError)
  }
})

router.post('/google_auth', async (req, res, next) => {
  try {
    const { clientId, credential } = req.body;

    const ticket = await getDecodedOAuthJwtGoogle(credential, clientId);

    const payload = ticket?.getPayload()

    if(!payload) {
      throw new AppError('Не удалось получить данные пользователя из Google. Проверьте валидность токена.', 422);
    }

    const login = payload.email?.split('@')[0]

    let user = await db.user.findUnique({
      where: {
        login
      }
    })

    if(!user) {
      user = await db.user.create({
        data: {
          login: login!
        }
      })

      if(payload.picture) {
        await reuploadPhotoToCloudinary(payload.picture, user.id)
      }  
    }
    
    await generateTokensForUser(user.id, res)

    res.status(200).json({ id: user.id });
  } catch(error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error);
    next(wrappedError)
  }
})

router.post('/logout', async (req, res, next) => {
  try {
    const { accessToken } = req.cookies;

    const { id } = jwt.verify(accessToken, process.env.JWT_SECRET ?? 'secretKey') as { id: string };

    await clearTokensForUser(id, res);

    res.status(200).send()
  } catch(error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error);
    next(wrappedError)
  }
})

export default router;
