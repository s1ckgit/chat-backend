import { Prisma } from "@prisma/client";
import { NextFunction, Response, Request } from "express";
import { AppError } from "../utils/errors";

export function appErrorsMiddlewareMiddleware(
  err: AppError | unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    res.status(err.httpCode).json({
      error: err.message,
      details: err.details,
    });
  } else {
    console.error('Неизвестная ошибка:', err);
    res.status(500).json({
      error: 'Произошла внутренняя ошибка сервера',
      details: undefined
    });
  }
}
