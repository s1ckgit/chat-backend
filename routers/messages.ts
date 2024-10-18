import { Router } from 'express';
import db from '../prisma/client';
import { Server } from "socket.io";

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
            select: {
              login: true
            },
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

  messagesNamespace.on('connection', async (socket) => {
    const userId = socket.handshake.query.userId as string;
    socket.join(userId);

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
            select: {
              login: true
            },
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
      conversations.forEach((conversation) => {
        const roomId = conversation.id.toString();
        socket.join(roomId);
      });

      socket.emit('conversations');
    } catch (error) {
      console.error('Error connecting to rooms:', error);
      socket.emit('error', { message: 'Ошибка при подключении к комнатам.' });
    }

    socket.on('send_message', async ({ conversationId, senderId, receiverId, content }) => {
      console.log('новое сообщение')

      try {
        let conversation

        if(conversationId) {
          conversation = await db.conversation.findFirst({
            where: {
              id: conversationId
            }
          })
        } else {
          conversation = await db.conversation.create({
            data: {
              participants: {
                connect: [
                  { id: senderId },
                  { id: receiverId }
                ]
              }
            }
          });

          const contact = await db.userContact.findFirst({
            where: { userId, contactId: receiverId }
          })

          await db.userContact.update({
            where: { id: contact?.id },
            data: { conversationId: conversation.id }
          })

          messagesNamespace.to([userId, contact?.contactId!]).emit('new_conversation');
          console.log('новый диалог')
        }

        const message = await db.message.create({
          data: {
            content,
            senderId,
            conversationId: conversation!.id,
          },
        });

        await db.conversation.update({
          where: { id: conversation!.id },
          data: { lastMessageId: message.id }
        })

        messagesNamespace.to(conversation!.id.toString()).emit(`new_message_${conversation?.id}`);
      } catch (e) {
          console.error('Error sending message:', e);
          socket.emit('error', { message: 'Ошибка на сервере при отправке сообщения.' });
      }
    })
  });
} 

export default router;
