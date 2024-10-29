import { Router } from 'express';
import db from '../prisma/client';

const router = Router();

  router.get('/messages/:id', async (req, res) => {
    const conversationId = req.params.id;
  
    try {
      const messages = await db.conversation.findFirst({
        where: {
          id: conversationId
        },
        select: {
          messages: {
            orderBy: {
              createdAt: 'asc'
            }
          }
        }
      })
    
      res.status(200).json(messages?.messages);
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
          lastMessage: {
            select: {
              content: true,
              sender: true,
              createdAt: true
            }
          }
        }
      });
  
      res.status(200).send(conversations)
    } catch(e) {
      res.status(500).send({
        error: 'Ошибка сервера. Повторите попытку позже'
      })
    }
  })

export default router;
