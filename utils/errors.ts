import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import type { Socket } from "socket.io";


export class AppError extends Error {
  public details?: any;
  public httpCode: number;

  constructor(message: string, httpCode: number, details?: any) {
    super(message);
    this.details = details;
    this.httpCode = httpCode;

    this.name = this.constructor.name;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      httpCode: this.httpCode,
      details: this.details,
    };
  }
}

export const wrapPrismaErrorIntoAppErrorInstance = (
  error: 
  Prisma.PrismaClientKnownRequestError |
  Prisma.PrismaClientInitializationError |
  Prisma.PrismaClientValidationError
) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        const target = (error.meta?.target as string[])?.join(', ') || 'Неизвестное поле';
        return new AppError(
          `Обнаружено дублирование уникального значения: ${target}. Пожалуйста, попробуйте другое значение для поля ${target}`,
          400, 
          {
            message: 'duplicate',
            value: `${target}`
          }
        )
      }
      case 'P2025': {
        return new AppError(
          'Ничего не найдено, попробуйте повторить запрос с другими параметрами',
          404
        )
      }
    }
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    return new AppError(
      'Ошибка базы данных. Попробуйте позже.',
      500
    )
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    return new AppError(
      `Ошибка валидации запроса: ${error.message}`,
      422
    )
  }
}

export const wrapUnknowErrorIntoAppErrorInstance = (error: unknown) => {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientValidationError
  ) return wrapPrismaErrorIntoAppErrorInstance(error);

  else if(error instanceof jwt.JsonWebTokenError) return new AppError('Недействительный токен аутентификации(refresh/auth)', 401)

  return error;
}

// export function handlePrismaError(e: unknown): { status: number; message: string; details?: any } {
//   if (e instanceof Prisma.PrismaClientKnownRequestError) {
//     switch (e.code) {
//       case 'P2002': {
//         const target = (e.meta?.target as string[])?.join(', ') || 'Неизвестное поле';
//         return {
//           status: 400,
//           message: `Обнаружено дублирование уникального значения: ${target}. Пожалуйста, попробуйте другое значения для поля ${target}`,
//           details: {
//             message: 'duplicate',
//             value: `${target}`
//           }
//         };
//       }
//       case 'P2025': {
//         return {
//           status: 404,
//           message: 'Ничего не найдено, попробуйте повторить запрос с другими параметрами',
//         };
//       }
//     }
//   } else if (e instanceof Prisma.PrismaClientInitializationError) {
//     return {
//       status: 500,
//       message: 'Ошибка базы данных. Попробуйте позже.',
//     };
//   } else if (e instanceof Prisma.PrismaClientValidationError) {
//     return {
//       status: 422,
//       message: `Ошибка валидации запроса: ${e.message}`,
//     };
//   }
//   return {
//     status: 500,
//     message: 'Неизвестная ошибка. Повторите позже.',
//   };
// }

// export function handleSocketError(socket: Socket, error: unknown) {
//   if (error instanceof SocketAppError) {
//     socket.emit('error', { message: error.message, details: error.details });
//   } else {
//     console.error('Неизвестная ошибка в Web-Sockets:', error);
//     socket.emit('error', { message: 'Произошла непредвиденная ошибка на сервере.', details: { reason: 'unknown' } });
//   }
// }
