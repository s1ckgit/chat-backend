import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import db from '../prisma/client';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accessToken, refreshToken } = req.cookies;

    if (accessToken) {
      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET ?? 'secretKey') as { id: string };
      const user = await db.user.findUnique({ where: { id: decoded.id } });
      
      if (user) {
        req.user = user;
        next();
        return;
      }
    }

    if (refreshToken) {
      const refreshDecoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET ?? 'refreshSecretKey') as { id: string };
      const user = await db.user.findUnique({ where: { id: refreshDecoded.id } });

      if (user && user.refreshToken === refreshToken) {
        res.status(401).json({ message: 'Access token expired. Refresh needed.', reason: 'token_expired' });
        return;
      }
    }

    res.status(401).json({ error: 'Unauthorized. Please log in again.', reason: 'unauthorized' });
  } catch (error) {
    console.error(error);
    res.status(401).json({ error: 'Unauthorized. Invalid token.' });
  }
};
