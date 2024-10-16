import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import db from '../prisma/client';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.token;

    if(!token) {
      res.status(401).json({
        error: "Ошибка авторизации. Попробуйте авторизоваться заново"
      })
      return

    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET ?? 'secretKey') as { id: string };

    const user = await db.user.findUnique({
      where: {
        id: decoded.id
      }
    })

    if(!user) {
      res.status(401).json({
        error: "Ошибка авторизации. Попробуйте авторизоваться заново"
      })
      return
    }

    req.user = user;

    next();
  }  catch (error) {
    console.error(error);
    res.status(401).json({ error: 'Ошибка авторизации. Неверный токен.' });
    return
  }
}
