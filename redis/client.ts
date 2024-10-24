import { createClient } from 'redis';

const client = createClient({
    password: 'rn55Jkc6ccwPJxTstmNVlduq9632S0Uv',
    socket: {
        host: 'redis-10658.c328.europe-west3-1.gce.redns.redis-cloud.com',
        port: 10658
    }
});

client.connect().catch((err) => {
  console.error('Ошибка подключения к Redis:', err);
});

export default client;
