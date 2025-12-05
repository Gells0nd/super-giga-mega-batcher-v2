import express from 'express';
import cors from 'cors';
import itemsRouter from './src/routes/items.js';
import { batchProcessor } from './src/services/BatchProcessor.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use('/api', itemsRouter);

app.use((err, req, res, next) => {
  console.error('Необработанная ошибка:', err);
  res.status(500).json({error: 'Внутренняя ошибка сервера'});
});

// TODO: Вынести в отдельный модуль
// Кетчер ошибок в случае, если исключение не поймали в try / catch
process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанное исключение:', reason);
});

app.listen(PORT, () => {
  console.log(`Сервер доступен по адресу: http://localhost:${PORT}/api\n`);
  batchProcessor.start();
});

process.on('SIGTERM', () => {
  console.log('\nПолучен сигнал SIGTERM, сворачиваемся...');
  batchProcessor.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nПолучен сигнал SIGINT, сворачиваемся...');
  batchProcessor.stop();
  process.exit(0);
});
