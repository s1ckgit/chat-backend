import { Prisma } from "@prisma/client";
import { NextFunction, Response, Request } from "express";
import { AppError } from "../utils/errors";

// export function prismaErrorMiddleware(
//   err: unknown,
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) {
//    if (
//     err instanceof Prisma.PrismaClientKnownRequestError || 
//     err instanceof Prisma.PrismaClientValidationError ||
//     err instanceof Prisma.PrismaClientInitializationError
//    ) {
//     const error = handlePrismaError(err);
//     const { status, message } = error;
//     const details = error.details;

//     res.status(status).json({ message, details });
//   } else {
//     next(err);
//   }
// }


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
