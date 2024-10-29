import { Namespace, Socket } from 'socket.io';
import db from '../prisma/client';
import redis from '../redis/client';
import cron from 'node-cron';

export async function getOrCreateConversation({ conversationId, senderId, receiverId, userId, namespace }: { conversationId: string, senderId: string, receiverId: string, userId: string, namespace: Namespace }) {
  if (conversationId) {
    return await db.conversation.findFirst({ where: { id: conversationId } });
  } else {
    const newConversation = await db.conversation.create({
      data: {
        participants: {
          connect: [
            { id: senderId },
            { id: receiverId }
          ]
        }
      }
    });

    const contact = await db.userContact.findFirst({ where: { userId: senderId, contactId: receiverId } });
    await db.userContact.update({ where: { id: contact?.id }, data: { conversationId: newConversation.id } });

    namespace.to([userId, contact?.contactId!]).emit('new_conversation', {
      id: newConversation.id
    });
    namespace.to(userId).emit('new_conversation_opened', {
      id: newConversation.id
    })

    return newConversation;
  }
}

export async function connectToAllConversations({ userId, socket }: { userId: string, socket: Socket }) {
  try {
    const conversations = await db.conversation.findMany({
      where: {
        participants: {
          some: { id: userId }
        }
      },
    });
    conversations.forEach((conversation) => {
      const roomId = conversation.id.toString();
      socket.join(roomId);
    });

    socket.emit('conversations');
    
    socket.on('new_conversation', ({ id }) => {
      socket.join(id);
    })
  } catch (error) {
    console.error('Error connecting to rooms:', error);
    socket.emit('error');
  }
}

export async function createMessage({ messageId, createdAt, content, senderId, conversation, status, namespace }: { messageId: string, createdAt: string, content: string, senderId: string, conversation: { id: string; lastMessageId: string | null; createdAt: Date; } | null, status: string, namespace: Namespace }) {
  let message = await db.message.create({
    data: {
      id: messageId,
      createdAt,
      content,
      senderId,
      conversationId: conversation!.id,
      status
    },
  });

  await db.conversation.update({
    where: { id: conversation!.id },
    data: { lastMessageId: message.id }
  })

  message = await db.message.update({
    where: {
      id: message.id
    },
    data: {
      status: 'delivered'
    }
  })

  namespace.to(conversation!.id).emit(`new_message_${conversation!.id}`, {
    senderId,
    message
  });
}

export async function controlSessionsCount({ userId, messagesSocket, statusesNamespace }: { userId: string, messagesSocket: Socket, statusesNamespace: Namespace }) {
  const currentStatus = await getUserStatus(userId);

  
  const sessionsCount = await redis.incr(`active_sessions:${userId}`);

  if (sessionsCount >= 1 && currentStatus !== 'online') {
    await updateUserStatus({ userId, status: 'online' });
    statusesNamespace.to(`status-${userId}`).emit(`status_${userId}`, {
      status: 'online'
    });
  }

  await redis.zRem("disconnect_timers", userId);
  
  messagesSocket.on('disconnect', async () => {
    const sessionsCount = await redis.decr(`active_sessions:${userId}`);
    console.log('disconnected', sessionsCount);

    if (sessionsCount <= 0) {
      await redis.del(`active_sessions:${userId}`);

      const disconnectTime = Date.now() + 30000;
      await redis.zAdd("disconnect_timers", [{ score: disconnectTime, value: userId }]);
    }
  });
} 

async function updateUserStatus({ userId, status }: { userId: string, status: string }) {
  await db.user.update({
    where: { id: userId },
    data: { status }
  });

  await redis.set(`user_status:${userId}`, status, {
    EX: 3600
  })
}

export async function getUserStatus(userId: string) {
  const cachedStatus = await redis.get(`user_status:${userId}`);
  if (cachedStatus) {
    return cachedStatus;
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (user) {
    await redis.set(`user_status:${userId}`, String(user.status), {
      EX: 3600
    })
    return user.status;
  }

  return null;
}

export async function processOfflineStatus(statusesNamespace: Namespace) {
  const now = Date.now();
  
  const expiredUsers = await redis.zRangeByScore("disconnect_timers", "-inf", now);

  const promises = expiredUsers.map(async (userId) => {
    try {
      await updateUserStatus({ userId, status: 'offline' });
      statusesNamespace.to(`status-${userId}`).emit(`status_${userId}`, { status: 'offline' });
      await redis.zRem("disconnect_timers", userId);
    } catch (error) {
      console.error(`Error updating status for user ${userId}:`, error);
    }
  });
  
  await Promise.all(promises);  
}

export function startStatusUpdater(statusesNamespace: Namespace) {
  cron.schedule('*/10 * * * * *', async () => {
    await processOfflineStatus(statusesNamespace);
  });
}

export async function getUnreadCount({ conversationId, userId }: { conversationId: string, userId: string }) {
  const messageKeys = await redis.keys(`unread_messages:${conversationId}:*`);
  let unreadCount = 0;

  const promises = messageKeys.map(key => redis.sIsMember(key, userId));
  const results = await Promise.all(promises);

  unreadCount = results.filter(isUnread => isUnread).length;

  return unreadCount;
}
