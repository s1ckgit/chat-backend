import type { Namespace, Socket } from "socket.io";
import redis from '../redis/client';
import db from '../prisma/client';
import { createMessage, getOrCreateConversation } from "./db";
import type { Imessages_read_event_data, Irequest_unread_event_data, Isend_message_event_data, Ityping_event_data } from "../types";
import { getUnreadCount, removeUserIdFromUnreadMessages } from "./redis";
import { wrapUnknowErrorIntoAppErrorInstance } from "./errors";

export const typing_handler = async (messagesNamespace: Namespace, { userId, conversationId }: Ityping_event_data) => {
  messagesNamespace.to(conversationId).emit(`typing_${conversationId}`, {
    userId
  })
}

export const send_message_handler = async (socket: Socket, messagesNamespace: Namespace, 
  { 
    conversationId, 
    senderId, 
    receiverId, 
    content, 
    id, 
    createdAt, 
    status, 
    attachments
 }: Isend_message_event_data) => {

  try {
    const conversation = await getOrCreateConversation({ 
      conversationId, 
      senderId, 
      receiverId, 
      namespace: messagesNamespace
    })
    
    await createMessage({ 
      id, 
      createdAt, 
      content, 
      senderId, 
      conversationId: conversation.id,
      status, 
      attachments, 
      namespace: messagesNamespace
    })

    await redis.sAdd(`unread_messages:${conversation?.id}:${id}`, receiverId);

    const unreadCount = await getUnreadCount({ conversationId, userId: receiverId });
    messagesNamespace.to(receiverId).emit(`unread_count_${conversationId}`, { unreadCount });

  } catch (error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error);
    socket.emit('error', { error: wrappedError })
  }
}

export const messages_read_handler = async (socket: Socket, messagesNamespace: Namespace, userId: string, { ids, conversationId }: Imessages_read_event_data) => {
  try {
    await db.message.updateMany({
      where: {
        id: { in: ids }
      },
      data: {
        status: 'read'
      }
    });

    await removeUserIdFromUnreadMessages(ids, userId, conversationId);

    messagesNamespace.to(conversationId).emit(`messages_read_${conversationId}`, {
      ids
    });
    
    const unreadCount = await getUnreadCount({ conversationId, userId });
    messagesNamespace.to(userId).emit(`unread_count_${conversationId}`, { unreadCount });
  } catch(error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error);
    socket.emit('error', { error: wrappedError })
  }
}

export const request_unread_count = async (socket: Socket, userId: string, { conversationId }: Irequest_unread_event_data) => {
  try {
    const unreadCount = await getUnreadCount({ conversationId, userId });
    socket.emit(`unread_count_${conversationId}`, { unreadCount });
  } catch(error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error);
    socket.emit('error', { error: wrappedError })
  }
}
