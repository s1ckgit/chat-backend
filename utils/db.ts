import { Namespace, Socket } from 'socket.io';
import db from '../prisma/client';
import redis from '../redis/client';
import { format } from "date-fns";
import { AppError } from './errors';

export async function getOrCreateConversation({ 
  conversationId, 
  senderId, 
  receiverId, 
  namespace
 }: Pick<IMessage, 'conversationId' | 'senderId'> & { namespace: Namespace, receiverId: string }) {
  if (conversationId) {
    const conversation = await db.conversation.findFirst({ where: { id: conversationId } });

    if(!conversation) {
      throw new AppError('Диалог не найден', 404);
    }

    return conversation;
  } 
  else {
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

    const [senderContact, receiverContact] = await getBothContacts(senderId, receiverId);

    if(!senderContact) {
      throw new AppError('Контакт отправителя не найден', 404);
    }

    await db.userContact.update({ where: { id: senderContact.id }, data: { conversationId: newConversation.id } });
    if(receiverContact) {
      await db.userContact.update({ where: { id: receiverContact.id }, data: { conversationId: newConversation.id } })
    }

    namespace.to([senderId, receiverId]).emit('new_conversation', {
      id: newConversation.id
    });
    namespace.to(senderId).emit('new_conversation_opened', {
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
    throw error
  }
}

export async function createMessage({ 
  id, 
  createdAt, 
  content, 
  senderId, 
  conversationId, 
  status, 
  attachments, 
  namespace
 }: IMessage & { namespace: Namespace }  ) {
  const message = await db.message.create({
    data: {
      id,
      createdAt,
      content,
      senderId,
      conversationId,
      status: 'delivered',
      attachments
    },
  });

  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageId: message.id }
  })

  const dateGroup = format(new Date(), 'dd.MM.yyyy')

  namespace.to(conversationId).emit(`new_message_${conversationId}`, {
    message,
    dateGroup
  });
}

export async function controlSessionsCount({ 
  userId, 
  messagesSocket, 
  statusesNamespace
 }: { userId: string, messagesSocket: Socket, statusesNamespace: Namespace }) {
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

    if (sessionsCount <= 0) {
      await redis.del(`active_sessions:${userId}`);

      const disconnectTime = Date.now() + 30000;
      await redis.zAdd("disconnect_timers", [{ score: disconnectTime, value: userId }]);
    }
  });
} 

export async function updateUserStatus({ userId, status }: { userId: string, status: string }) {
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

export const getBothContacts = async (senderId: string, receiverId: string) => {
  const senderContactPromise = db.userContact.findFirst({ 
    where: {
      userId: senderId,
      contactId: receiverId
    }
  })

  const receiverContactPromise = db.userContact.findFirst({
    where: {
      userId: receiverId,
      contactId: senderId
    }
  })

  const [senderContact, receiverContact] = await Promise.all([senderContactPromise, receiverContactPromise]);

  return [senderContact, receiverContact];

}
