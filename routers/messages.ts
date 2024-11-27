import { Router } from 'express';
import db from '../prisma/client';
import multer from 'multer';
import { uploadAttachments } from '../utils/media';

const router = Router();
const upload = multer();

  router.get('/messages/:id', async (req, res) => {
    const conversationId = req.params.id;
  
    try {
      // const messages = await db.conversation.findFirst({
      //   where: {
      //     id: conversationId
      //   },
      //   select: {
      //     messages: {
      //       orderBy: {
      //         createdAt: 'asc'
      //       }
      //     }
      //   }
      // })

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
    } catch(e) {
      res.status(500).json({
        error: 'Ошибка сервера. Невозможно получить сообщения'
      })
    }
  
    return;
  })

  router.get('/lastmessage/:conversationId', async (req, res) => {
    const { conversationId } = req.params;

    try {
      const lastMessage = await db.conversation.findUnique({
        where: {
          id: conversationId
        },
        select: {
          lastMessage: true
        }
      })

      const result = lastMessage?.lastMessage;

      res.status(200).json(result);
    } catch(e) {
      res.status(500).json({
        error: 'Ошибка сервера'
      })
    }
  })

  router.get('/me/conversations', async (req, res) => {
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
    } catch(e) {
      res.status(500).send({
        error: 'Ошибка сервера. Повторите попытку позже'
      })
    }
  })

  router.post('/messages/attachments', upload.array('attachments'), async (req, res) => {
    const { conversationId, messageId } = req.body;
    const attachmentsFiles = req.files as Express.Multer.File[];
    console.log(attachmentsFiles);

    if(!attachmentsFiles) {
      res.status(400).json({
        message: 'Нет вложений'
      })
      return;
    }

    const attachments = await uploadAttachments({ conversationId, messageId, files: attachmentsFiles })

    res.status(200).json(attachments);
    return;
  })

export default router;
