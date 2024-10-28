import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import userRouter from './routers/users';
import authRouter from './routers/auth';
import messagesRouter from './routers/messages';

import { authMiddleware } from './middleware/auth';
import { setupSockets } from './utils/sockets';

const app = express();
const server = http.createServer(app);
const PORT = 3000;
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true
  },
});

const corsOptions = {
  origin: 'http://localhost:5173',
  credentials: true,
};



app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors(corsOptions));

setupSockets(io);
app.use('/api', authRouter);
app.use('/api', authMiddleware, userRouter);
app.use('/api', authMiddleware, messagesRouter);



server.listen(PORT, () => {
  console.log('Hello world');
})
