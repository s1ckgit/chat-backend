import { Server } from "socket.io";
import { connectToAllConversations, controlSessionsCount, getUserStatus } from '../utils/db';
import { messages_read_handler, request_unread_count, send_message_handler, typing_handler } from "./socket-handlers";
import type { Imessages_read_event_data, Irequest_unread_event_data, Isend_message_event_data, Ityping_event_data } from "../types";
import { startStatusUpdater } from "./redis";
import { AppError, wrapUnknowErrorIntoAppErrorInstance } from "./errors";

export const setupSockets = (io: Server) => {
  const messagesNamespace = io.of('/api/messages');
  const statusesNamespace = io.of('/api/statuses');
  const usersNamespace = io.of('/api/users');
  
  startStatusUpdater(statusesNamespace);

  usersNamespace.on('connection', async (socket) => {
    socket.on(`user_avatar`, ({ id }) => {
      socket.join(`user_avatar_${id}`);
    })

    socket.on(`user_avatar_update`, ({ id }) => {
      usersNamespace.to(`user_avatar_${id}`).emit(`user_avatar_update_${id}`)
    })
  })

  statusesNamespace.on('connection', async (socket) => {
    try {
      socket.on('get_status', async ({ id }) => {
        const status = await getUserStatus(id);
        socket.join(`status-${id}`);
        socket.emit(`status_${id}`, {
          status: status
        });
      })
      socket.on('get_status_off', async ({ id }) => {
        socket.leave(`status-${id}`)
      })
    } catch(error) {
      const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error);
      socket.emit('error', { error: wrappedError })
    }
  })

  messagesNamespace.on('connection', async (socket) => {
    try {
      const userId = socket.handshake.query.userId as string;
      if(!userId) return;
      socket.join(userId);
      await connectToAllConversations({ userId, socket });
      await controlSessionsCount({ userId, messagesSocket: socket, statusesNamespace });

      socket.on('typing', (data: Ityping_event_data) => typing_handler(messagesNamespace, data))

      socket.on('send_message', (data: Isend_message_event_data) => send_message_handler(socket, messagesNamespace, data))

      socket.on('messages_read', (data: Imessages_read_event_data) => messages_read_handler(socket, messagesNamespace, userId, data))

      socket.on('request_unread_count', (data: Irequest_unread_event_data) => request_unread_count(socket, userId, data))
    } catch(error) {
      const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error);
      socket.emit('error', { error: wrappedError })
    }
  });
} 
