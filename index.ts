import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import userRouter from './routers/users';
import { setupMessagesRouter } from './routers/messages';
import authRouter from './routers/auth';
import { authMiddleware } from './middleware/auth';

const app = express();
const server = http.createServer(app);
const PORT = 3000;
const io = new Server(server);

const corsOptions = {
  origin: 'http://localhost:5173',
  credentials: true,
};



app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors(corsOptions));

app.use((req, res, next) => {
  req.on('finish', () => {
    console.log('request Headers:', req.headers);
  });
  next();
});

setupMessagesRouter(io);
app.use('/api', authRouter);
app.use('/api', authMiddleware, userRouter);



server.listen(PORT, () => {
  console.log('Hello world');
})
