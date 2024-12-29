import { Router } from 'express';
import db from '../prisma/client';
import multer from 'multer';
import { uploadAvatar } from '../utils/media';
import { AppError, wrapUnknowErrorIntoAppErrorInstance } from '../utils/errors';

const router = Router();
const upload = multer();

router.get('/user/:id', async (req, res, next) => {
  const id = req.params.id;

  try {
    const user = await db.user.findUnique({
      where: {
        id
      }
    })

    if(!user) {
      throw new AppError(`Не удалось получить информацию пользователя с id: ${id} Пользователь не найден.`, 404)
    }

    res.status(200).json(user);
  } catch(error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error);
    next(wrappedError)
  }
})

router.post('/contacts/add', async (req, res, next) => {
  const { login } = req.body;

  const id = req.user?.id;

  try {
    const contactToAddUser = await db.user.findUnique({
      where: {
        login
      }
    })

    if(!contactToAddUser) {
      throw new AppError(`Не удалось добавить пользователя с логином ${login} в список контактов. Пользователь не найден`, 404)
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
        contactId: contactToAddUser.id
      }
    })

    const contactFromContactToAddUser = await db.userContact.findFirst({
      where: {
        userId: contactToAddUser.id,
        contactId: user.id
      }
    })

    if(contactFromContactToAddUser?.conversationId) {
      await db.userContact.update({
        where: {
          id: newContact.id
        },
        data: {
          conversationId: contactFromContactToAddUser.conversationId
        }
      })
    }

    res.status(201).json(newContact)
  } catch(error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error);
    next(wrappedError)
  }
})

router.get('/me', async (req, res, next) => {
  const id = req.user?.id;

  try {
    const user = await db.user.findUnique({
      where: {
        id
      }
    })

    if(!user) {
      throw new AppError('Не удалось получить информацию о пользователе. Пользователь не найден.', 404)
    }

    res.status(200).json(user);
  } catch(error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error);
    next(wrappedError)
  }
})

router.post('/me', async (req, res, next) => {
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
  } catch(error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error);
    next(wrappedError)
  }
})

router.get('/me/contacts', async (req, res, next) => {
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

    res.status(200).json(contacts);
  } catch(error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error);
    next(wrappedError)
  }
})

router.post('/me/avatar', upload.single('file'), async (req, res, next) => {
  if(!req.file) {
    throw new AppError('Файл с изображением не найден.', 400)
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
  } catch(error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error);
    next(wrappedError)
  }
})

router.get('/user/:id/:property', async (req, res, next) => {
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
      throw new AppError('Пользователь с таким id не найден', 404)
    }
    res.status(200).json(user[property]);
    return;
  } catch(error) {
    const wrappedError = wrapUnknowErrorIntoAppErrorInstance(error);
    next(wrappedError)
  }
})

export default router;
