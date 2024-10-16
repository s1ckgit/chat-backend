import { Router } from 'express';
import db from '../prisma/client';

const router = Router();

router.get('/user/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const user = await db.user.findUnique({
      where: {
        id
      }
    })

    if(!user) {
      res.status(400).json({
        error: 'Пользователь не найден'
      })
      
      return;
    }

    res.status(200).json(user);
  } catch(e) {
    res.status(500).json({
      error: 'Ошибка сервера'
    })
  }
})

router.get('/me', async (req, res) => {
  const id = req.user?.id;

  try {
    const user = await db.user.findUnique({
      where: {
        id
      }
    })

    if(!user) {
      res.status(400).json({
        error: 'Пользователь не найден'
      })
      
      return;
    }

    res.status(200).json(user);
  } catch(e) {
    res.status(500).json({
      error: 'Ошибка сервера'
    })
  }
})

export default router;
