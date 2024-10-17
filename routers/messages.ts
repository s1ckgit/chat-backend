import db from '../prisma/client';
import { Server } from "socket.io";

export const setupMessagesRouter = (io: Server) => {
  const messagesNamespace = io.of('/api/messages');

  messagesNamespace.on('connection', async (socket) => {
    const userId = socket.handshake.query.userId as string;

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
        // include: {
        //   participants: {
        //     select: {
        //       login: true
        //     },
        //     where: {
        //       id: {
        //         not: userId
        //       }
        //     }
        //   },
        //   lastMessage: true
        // }
      });
      conversations.forEach((conversation) => {
        const roomId = conversation.id.toString();
        socket.join(roomId);
      });

      socket.emit('conversations', {
        conversations,
      });
    } catch (error) {
      console.error('Error connecting to rooms:', error);
      socket.emit('error', { message: 'Ошибка при подключении к комнатам.' });
    }

    socket.on('send_message', async ({ senderId, receiverId, content }) => {
      try {
        let conversation = await db.conversation.findFirst({
          where: {
            participants: {
              every: {
                id: { in: [senderId, receiverId] }
              }
            }
          }
        });

        if (!conversation) {
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
        }

        const message = await db.message.create({
          data: {
            content,
            senderId,
            conversationId: conversation.id,
          },
        });

        messagesNamespace.to(conversation.id.toString()).emit('new_message', message);
      } catch (e) {
          console.error('Error sending message:', e);
          socket.emit('error', { message: 'Ошибка на сервере при отправке сообщения.' });
      }
    })
  });


  // router.post('/messages', async (req, res) => {
  //   const { senderId, receiverId, content } = req.body;
  
  //   try {
  //     let conversation = await db.conversation.findFirst({
  //       where: {
  //         participants: {
  //           every: {
  //             id: { in: [senderId, receiverId] }
  //           }
  //         }
  //       }
  //     })
  
  //     if (!conversation) {
  //       conversation = await db.conversation.create({
  //         data: {
  //           participants: {
  //             connect: [
  //               { id: senderId },
  //               { id: receiverId }
  //             ]
  //           }
  //         }
  //       })
  //     }
  
  //     const message = await db.message.create({
  //       data: {
  //         content,
  //         senderId,
  //         conversationId: conversation.id,
  //       },
  //     });
  
  //     res.status(201).json({ status: 'Сообщение отправлено', data: message });
  //     return 
  //   } catch(e) {
  //     console.error(e);
  //     res.status(500).json({ error: 'Ошибка на сервере при отправке сообщения.' });
  //     return 
  //   }
  // })
  
  // router.get('/conversations', async (req, res) => {
  //   const userId = req.user?.id;
  
  //   try {
  //     const conversations = await db.conversation.findMany({
  //       where: {
  //         participants: {
  //           some: { 
  //             id: userId,
  //           },
  //         },
  //       },
  //       select: {
  //         id: true,
  //         participants: {
  //           where: {
  //             id: {
  //               not: userId
  //             }
  //           },
  //           select: {
  //             login: true
  //           }
  //         },
  //         lastMessage: {
  //           select: {
  //             createdAt: true,
  //             content: true,
  //             sender: {
  //               select: {
  //                 login: true
  //               }
  //             }
  //           }
  //         }
  //       }
  //     });
  
  //     res.json(conversations);
  //   } catch (error) {
  //     console.error(error);
  //     res.status(500).json({ error: 'Server error' });
  //   }
  // });
  
  // router.get('/conversations/:id', async (req, res) => {
  //   const conversationId = req.params.id;
  
  //   try {
  //     const messages = await db.conversation.findFirst({
  //       where: {
  //         id: conversationId
  //       },
  //       select: {
  //         messages: true
  //       }
  //     })
    
  //     res.send(200).json(messages);
  //   } catch(e) {
  //     res.send(500).json({
  //       error: 'Ошибка сервера. Невозможно получить сообщения'
  //     })
  //   }
  
  //   return;
  // })

  // return router;
} 
