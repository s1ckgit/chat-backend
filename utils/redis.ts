import { Namespace } from 'socket.io';
import redis from '../redis/client';
import cron from 'node-cron';
import { updateUserStatus } from './db';

export const removeUserIdFromUnreadMessages = async (ids: string[], userId: string, conversationId: string) => {
  try {
    await Promise.all(
      ids.map((messageId) => 
        redis.sRem(`unread_messages:${conversationId}:${messageId}`, userId)
      )
    );
  } catch (error) {
    console.error('Error removing userId from unread messages:', error);
  }
};

export async function processOfflineStatus(statusesNamespace: Namespace) {
  const now = Date.now();
  
  const expiredUsers = await redis.zRangeByScore("disconnect_timers", "-inf", now);

  const promises = expiredUsers.map(async (userId) => {
    try {
      const now = Date.now();
      await updateUserStatus({ userId, status: `lastActive:${now}` });
      statusesNamespace.to(`status-${userId}`).emit(`status_${userId}`, { status: `lastActive:${now}` });
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
