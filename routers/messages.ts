import { Router } from 'express';
import db from '../prisma/client';
import multer from 'multer';
import { uploadAttachments } from '../utils/media';
import { AppError, wrapUnknowErrorIntoAppErrorInstance } from '../utils/errors';

const router = Router();
const upload = multer();

router.get('/messages/:id', async (req, res, next) => {
  const conversationId = req.params.id;

  try {
    const result = await db.$queryRaw`
      SELECT 
        TO_CHAR("createdAt", 'DD.MM.YYYY') AS date,
        JSON_AGG(m.* ORDER BY m."createdAt") AS messages
      FROM "Message" m
      WHERE m."conversationId" = ${conversationId}
      GROUP BY date
      ORDER BY date ASC;
    `;
  
    res.status(200).json(result);
  } catch(error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error);
    next(wrappedError)
  }
})

  // router.get('/lastmessage/:conversationId', async (req, res) => {
  //   const { conversationId } = req.params;

  //   try {
  //     const lastMessage = await db.conversation.findUnique({
  //       where: {
  //         id: conversationId
  //       },
  //       select: {
  //         lastMessage: true
  //       }
  //     })

  //     const result = lastMessage?.lastMessage;

  //     res.status(200).json(result);
  //   } catch(e) {
  //     res.status(500).json({
  //       error: 'Ошибка сервера'
  //     })
  //   }
  // })

router.get('/me/conversations', async (req, res, next) => {
  const userId = req.user?.id;

  try {
    const conversations = await db.conversation.findMany({
      where: {
        participants: {
          some: { id: userId }
        }
      },
      orderBy: {
        lastMessage: {
          createdAt: 'desc'
        }
      },
      select: {
        id: true,
        participants: {
          where: {
            id: {
              not: userId
            }
          }
        },
        lastMessage: true
      }
    });

    res.status(200).send(conversations)
  } catch(error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error);
    next(wrappedError)
  }
})

router.post('/messages/attachments', upload.array('attachments'), async (req, res, next) => {
  try {
    const { conversationId, messageId } = req.body;
    const attachmentsFiles = req.files as Express.Multer.File[];
  
    if(!attachmentsFiles) {
      throw new AppError('Вложения не найдены.', 400)
    }
    const attachments = await uploadAttachments({ conversationId, messageId, files: attachmentsFiles })
  
    res.status(200).json(attachments);
  } catch(error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error);
    next(wrappedError)
  }
})

export default router;
