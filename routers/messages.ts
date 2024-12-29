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
        JSON_AGG(
          json_build_object(
            'id', m.id,
            'createdAt', to_char("createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MSZ'),
            'content', m.content,
            'senderId', m."senderId",
            'conversationId', m."conversationId",
            'status', m.status,
            'attachments', m.attachments
          ) ORDER BY m."createdAt"
        ) AS messages
      FROM "Message" m
      WHERE m."conversationId" = ${conversationId}
      GROUP BY TO_CHAR("createdAt", 'DD.MM.YYYY')
      ORDER BY MIN(m."createdAt") ASC;
    `;
  
    res.status(200).json(result);
  } catch(error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error);
    next(wrappedError)
  }
})

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
