import { Server } from "socket.io";
import { connectToAllConversations, controlSessionsCount, createMessage, getOrCreateConversation, getUnreadCount, getUserStatus, startStatusUpdater } from '../utils/db';
import db from '../prisma/client';
import redis from '../redis/client';

export const setupSockets = (io: Server) => {
  const messagesNamespace = io.of('/api/messages');
  const statusesNamespace = io.of('/api/statuses');

  startStatusUpdater(statusesNamespace);

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

        await redis.sAdd(`unread_messages:${conversation?.id}:${messageId}`, receiverId);

        const unreadCount = await getUnreadCount({ conversationId, userId: receiverId });
        messagesNamespace.to(receiverId).emit(`unread_count_${conversationId}`, { unreadCount });

      } catch (e) {
          console.error('Error sending message:', e);
          socket.emit('error', { message: 'Ошибка на сервере при отправке сообщения.' });
      }
    })

    socket.on('messages_read', async ({ ids, conversationId }) => {
      try {
        await db.message.updateMany({
          where: {
            id: { in: ids }
          },
          data: {
            status: 'read'
          }
        });

        for (const messageId of ids) {
          await redis.sRem(`unread_messages:${conversationId}:${messageId}`, userId);
        }
        messagesNamespace.to(conversationId).emit(`messages_read_${conversationId}`, {
          ids
        });
        
        const unreadCount = await getUnreadCount({ conversationId, userId });
        messagesNamespace.to(userId).emit(`unread_count_${conversationId}`, { unreadCount });
        console.log('messages_read')
      } catch(e) {
        console.log('error', e)
      }
    })

    socket.on('request_unread_count', async ({ conversationId }) => {
      const unreadCount = await getUnreadCount({ conversationId, userId });
      socket.emit(`unread_count_${conversationId}`, { unreadCount });
    })
  });
} 
