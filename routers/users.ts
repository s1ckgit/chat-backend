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

router.post('/contacts/add', async (req, res) => {
  const { login } = req.body;

  const id = req.user?.id;

  try {
    const contactToAdd = await db.user.findUnique({
      where: {
        login
      }
    })

    if(!contactToAdd) {
      res.status(404).json({
        error: 'Пользователь не найден'
      })
      return;
    }

    const user = await db.user.findUnique({
      where: {
        id
      },
    })

    if(!user) return;

    const newContact = await db.userContact.create({
      data: {
        userId: user.id,
        contactId: contactToAdd.id
      }
    })

    res.status(201).json(newContact)
  } catch(e) {
    res.status(500).json({
      error: 'Ошибка сервера. Попробуйте позже'
    })
  }
})

router.get('/me', async (req, res) => {
  const id = req.user?.id;
  console.log('me');

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

router.get('/me/contacts', async (req, res) => {
  const id = req.user?.id;

  try {
    const contacts = await db.userContact.findMany({
      where: {
        userId: id
      },
      include: {
        contact: {
          select: {
            login: true
          }
        }
      }
    })

    if(!contacts) {
      res.status(200).send();
      return;
    }

    res.status(200).json(contacts);
  } catch(e) {
    res.status(500).json({
      error: 'Ошибка сервера'
    })
  }
})

export default router;
