import { requestQueue } from './RequestQueue.js';
import { itemStore } from '../models/ItemStore.js';

/*
 * По ТЗ:
 *  - На добавление элементов используем кд 10 сек
 *  - На прочтение элементов используем батчинг 1 сек
 */

class BatchProcessor {
  constructor() {
    this.isRunning = false;
    this.addInterval = null;
    this.readWriteInterval = null;
  }

  // Запускает обработчик
  start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Тут кд 10 сек (создание)
    this.addInterval = setInterval(() => {
      this.processAddBatch();
    }, 10000);

    // Тут кд 1 сек (изменение)
    this.readWriteInterval = setInterval(() => {
      this.processReadWriteBatch();
    }, 1000);

    console.log('BatchProcessor запущен');
  }

  // Останавливает обработчик
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.addInterval) {
      clearInterval(this.addInterval);
      this.addInterval = null;
    }

    if (this.readWriteInterval) {
      clearInterval(this.readWriteInterval);
      this.readWriteInterval = null;
    }

    console.log('BatchProcessor остановлен');
  }

  // Обработчик для добавления элементов
  processAddBatch() {
    try {
      const batch = requestQueue.getAddBatch();

      if (batch.length === 0) {
        return;
      }

      batch.forEach((item) => {
        try {
          let result;

          switch (item.operation) {
            case 'addItem':
              result = itemStore.addItem(item.data.id, item.data.label);
              item.resolve(result);

              // Очищаем дедупликацию после успешной обработки
              if (item.itemId) {
                requestQueue.clearProcessedId(item.itemId, result);
              }
              break;

            default:
              const unknownOpError = new Error(`Неизвестная операция: ${item.operation}`);
              item.reject(unknownOpError);
              if (item.itemId) {
                requestQueue.rejectProcessedId(item.itemId, unknownOpError);
              }
          }
        } catch (error) {
          // Сначала отклоняем общий промис для дедупликации, затем промис конкретного запроса
          // Иначе процесс падает
          // TODO: Узнать почему процесс падает
          if (item.itemId) {
            requestQueue.rejectProcessedId(item.itemId, error);
          }
          // Безопасное отклонение промиса конкретного запроса
          try {
            item.reject(error);
          } catch (rejectError) {
            // Если отклонение промиса само по себе вызывает ошибку, логируем её
            console.error('Ошибка при отклонении промиса:', rejectError);
          }
        }
      });
    } catch (error) {
      console.error('Критическая ошибка при обработке батча добавления:', error);
    }
  }

  // Батч для чтения и изменения
  processReadWriteBatch() {
    try {
      const batch = requestQueue.getReadWriteBatch();

      if (batch.length === 0) {
        return;
      }

      batch.forEach((item) => {
        try {
          let result;

          switch (item.operation) {
            case 'getAll':
              result = itemStore.getAll(item.data.page, item.data.limit, item.data.filterId);
              item.resolve(result);
              break;

            case 'getSelected':
              result = itemStore.getSelected(item.data.page, item.data.limit, item.data.filterId);
              item.resolve(result);
              break;

            case 'addToSelected':
              result = itemStore.addToSelected(item.data.id);
              const addResult = { success: result };
              item.resolve(addResult);
              if (item.itemId) {
                requestQueue.clearProcessedId(item.itemId, addResult);
              }
              break;

            case 'removeFromSelected':
              result = itemStore.removeFromSelected(item.data.id);
              const removeResult = { success: result };
              item.resolve(removeResult);
              if (item.itemId) {
                requestQueue.clearProcessedId(item.itemId, removeResult);
              }
              break;

            case 'reorderSelected':
              result = itemStore.reorderSelected(item.data.id, item.data.newIndex);
              const reorderResult = { success: result };
              item.resolve(reorderResult);
              if (item.itemId) {
                requestQueue.clearProcessedId(item.itemId, reorderResult);
              }
              break;

            default:
              const unknownOpError = new Error(`Неизвестная операция: ${item.operation}`);
              if (item.itemId) {
                requestQueue.rejectProcessedId(item.itemId, unknownOpError);
              }
              try {
                item.reject(unknownOpError);
              } catch (rejectError) {
                console.error('Ошибка при отклонении промиса:', rejectError);
              }
          }
        } catch (error) {
          if (item.itemId) {
            requestQueue.rejectProcessedId(item.itemId, error);
          }
          try {
            item.reject(error);
          } catch (rejectError) {
            console.error('Ошибка при отклонении промиса:', rejectError);
          }
        }
      });
    } catch (error) {
      console.error('Критическая ошибка при обработке батча чтения/изменения:', error);
    }
  }
}

// Singleton экземпляр
export const batchProcessor = new BatchProcessor();
