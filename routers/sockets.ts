import { Router } from 'express';
import { Server } from 'socket.io';
import db from '../prisma/client';

const router = Router();

export const setupSocketRouter = (io: Server) => {
  router.post('/sockets', async (req, res) => {
    const userId = req.user?.id;

    try {
      const conversations = await db.conversation.findMany({
        where: {
          participants: {
            some: {
              id: userId
            }
          },
        },
        select: {
          id: true
        }
      })

      conversations.forEach((conversation) => {
        const { id } = conversation;

        io.to(id).emit('joined', { id: userId })

        res.status(200).json({ message: 'User connected successfully' });
      })
    } catch(e) {
      console.error(e);
      res.status(500).json({ error: 'Server error' });
    }

  })

  return router;
}
