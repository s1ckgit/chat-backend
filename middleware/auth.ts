import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import db from '../prisma/client';

const ONE_YEAR = 10 * 365 * 24 * 60 * 60 * 1000;

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accessToken, refreshToken } = req.cookies;

    if (!accessToken) {
      if (!refreshToken) {
        res.status(401).json({
          error: "Ошибка авторизации. Попробуйте авторизоваться заново"
        });
        return 
      } else {
        const refreshDecoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET ?? 'refreshSecretKey') as { id: string };
        const user = await db.user.findUnique({
          where: {
            id: refreshDecoded.id
          }
        });

        if (user && user.refreshToken === refreshToken) {
          const newAccessToken = jwt.sign({ id: user?.id }, process.env.JWT_SECRET ?? 'secretKey', {
            expiresIn: '1h'
          });

          res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 1000
          });

          const newRefreshToken = jwt.sign({ id: user?.id }, process.env.JWT_REFRESH_SECRET ?? 'refreshSecretKey');

          res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: ONE_YEAR
          });

          await db.user.update({
            where: {
              id: user.id
            },
            data: {
              refreshToken: newRefreshToken
            }
          });

          req.user = user;

          next();
          return 
        }
      }
    }

    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET ?? 'secretKey') as { id: string };

    const user = await db.user.findUnique({
      where: {
        id: decoded.id
      }
    });

    if (!user) {
      res.status(401).json({
        error: "Ошибка авторизации. Попробуйте авторизоваться заново"
      });
      return 
    }

    req.user = user;

    next();
    return
  } catch (error) {
    console.error(error);
    res.status(401).json({ error: 'Ошибка авторизации. Неверный токен.' });
    return 
  }
};
