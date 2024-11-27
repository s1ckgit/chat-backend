import { Router } from 'express';
import db from '../prisma/client';
import multer from 'multer';
import { uploadAvatar } from '../utils/media';

const router = Router();
const upload = multer();

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
  console.log('me', Date.now());

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

router.post('/me', async (req, res) => {
  const data = req.body;
  const id = req.user?.id;

  try {
    const user = await db.user.update({
      where: {
        id
      },
      data
    })
    res.status(200).send(user)
  } catch(e) {
    console.log(e);
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
            id: true,
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

router.post('/me/avatar', upload.single('file'), async (req, res) => {
  if(!req.file) {
    res.status(400).json({ message: 'Файл не найден' })
    return
  }
  const userId = req.user!.id;

  try {
    const avatars = await uploadAvatar(req.file, userId);

    await db.user.update({
      where: {
        id: userId
      },
      data: {
        avatars
      }
    })

    res.status(200).json({ message: 'Файл успешно загружен' })
    return;
  } catch(e) {
    res.status(500).json({ message: `Ошибка: ${e}` })
  }
})

router.get('/user/:id/:property', async (req, res) => {
  const { id, property } = req.params;

  try {
    const user = await db.user.findUnique({
      where: {
        id
      },
      select: {
        [property]: true
      }
    })

    if(!user) {
      res.status(404).json({ message: 'Пользователь с таким id не найден' })
      return;
    }
    res.status(200).json(user[property]);
    return;
  } catch(e) {
    res.status(500).send(e)
    return;
  }
})

export default router;
