import { Router } from 'express';
import db from '../prisma/client';
import { Server } from "socket.io";
import { connectToAllConversations, controlSessionsCount, createMessage, getOrCreateConversation, getUserStatus } from '../utils/db';

const router = Router();

  router.get('/messages/:id', async (req, res) => {
    const conversationId = req.params.id;
  
    try {
      const messages = await db.conversation.findFirst({
        where: {
          id: conversationId
        },
        select: {
          messages: true
        }
      })
    
      res.status(200).json(messages);
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

export const setupMessagesRouter = (io: Server) => {
  const messagesNamespace = io.of('/api/messages');
  const statusesNamespace = io.of('/api/statuses');

  statusesNamespace.on('connection', async (socket) => {
    socket.on('get_status', async ({ id }) => {
      const status = await getUserStatus(id);
      socket.join(`status-${id}`);
      statusesNamespace.to(`status-${id}`).emit(`status_${id}`, {
        status: status
      });
    })
    socket.on('get_status_off', async ({ id }) => {
      socket.leave(`status-${id}`)
    })
  })

  messagesNamespace.on('connection', async (socket) => {
    const userId = socket.handshake.query.userId as string;
    if(!userId) return;
    socket.join(userId);
    await connectToAllConversations({ userId, socket });
    await controlSessionsCount({ userId, messagesSocket: socket, statusesNamespace });

    socket.on('typing', async ({ userId, conversationId }) => {
      messagesNamespace.to(conversationId).emit(`typing_${conversationId}`, {
        userId
      })
    })

    socket.on('send_message', async ({ conversationId, senderId, receiverId, content, id: messageId, createdAt, status }) => {

      try {
        const conversation = await getOrCreateConversation({ conversationId, senderId, receiverId, userId, namespace: messagesNamespace })
        
        await createMessage({ messageId, createdAt, content, senderId, conversation, status, namespace: messagesNamespace })

      } catch (e) {
          console.error('Error sending message:', e);
          socket.emit('error', { message: 'Ошибка на сервере при отправке сообщения.' });
      }
    })

    socket.on('message_read', async ({ id, conversationId }) => {
      try {
        const message = await db.message.update({
          where: {
            id
          },
          data: {
            status: 'read'
          }
        })
  
        const conversation = await db.conversation.findUnique({
          where: {
            id: conversationId
          }
        })
  
        messagesNamespace.to(conversation!.id).emit(`message_read_${message.id}`)
      } catch(e) {
        console.log('error', e)
      }
    })
  });
} 

export default router;
