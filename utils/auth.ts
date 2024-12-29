import { User } from "@prisma/client";
import type { Response } from "express";
import db from '../prisma/client';
import jwt from 'jsonwebtoken'; 
import { OAuth2Client } from "google-auth-library";
import { uploadAvatar } from "./media";
import { AppError } from "./errors";

export const reuploadPhotoToCloudinary = async (photoUrl: string, userId: User['id']) => {
  const response = await fetch(photoUrl);
  const blob = await response.blob();

  const imageFile = {
    mimetype: blob.type,
    buffer: Buffer.from(await blob.arrayBuffer())
  }

  const { thumbnailUrl, originalUrl } = await uploadAvatar(imageFile, userId)

  await db.user.update({
    where: {
      id: userId
    },
    data: {
      avatars: {
        thumbnailUrl,
        originalUrl
      }
    }
  })
}

export const getDecodedOAuthJwtGoogle = async (token: string, clientId: string) => {
  try {
    const client = new OAuth2Client(clientId)

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: clientId,
    })

    return ticket
  } catch (error) {
    throw new AppError('Ошибка верификации токена пользователя Google.', 422)
  }
}

export const clearTokensForUser = async (userId: User['id'], res: Response) => {
  await db.user.update({
    where: {
      id: userId
    },
    data: {
      refreshToken: null
    }
  })

  res.clearCookie('accessToken', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true
  })
  res.clearCookie('refreshToken', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true
  })
}

export const generateTokensForUser = async (userId: User['id'], res: Response) => {

  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET ?? 'secretKey', {
    expiresIn: '1h'
  })

  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET ?? 'refreshSecretKey', {
    expiresIn: '365d'
  })

  await db.user.update({
    where: {
      id: userId
    },
    data: {
      refreshToken
    }
  })

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 1000 * 8760
  })

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 1000
  })
}
