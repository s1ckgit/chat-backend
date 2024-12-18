import { createClient } from 'redis';

const client = createClient({
    password: 'rn55Jkc6ccwPJxTstmNVlduq9632S0Uv',
    socket: {
      host: 'redis-10658.c328.europe-west3-1.gce.redns.redis-cloud.com',
      port: 10658,
      reconnectStrategy: (retries) => {
        if (retries > 5) {
          console.error('Превышено количество попыток подключения.');
          return new Error('Превышено количество попыток подключения');
        }
        console.log(`Попытка переподключения #${retries + 1}`);
        return retries * 100;
      },
    },
});

client.on('connect', () => {
  console.log('Успешное подключение к Redis.');
});

client.on('error', (err) => {
  console.error('Ошибка Redis:', err);
});

client.connect().catch((err) => {
  console.error('Ошибка при первоначальном подключении:', err);
  process.exit(1);
});

export default client;
