// Очередь запросов со встроенной дедубликацией, что бы один запрос не был обработан дважды
class RequestQueue {
  constructor() {
    // Очередь операций добавления элементов, батчинг 10 сек
    this.addQueue = [];
    // Очередь операций чтения/изменения, батчинг 1 сек
    this.readWriteQueue = [];
    // Последние обработанные ID для дедупликации
    this.lastProcessedIds = new Set();
    // Промисы для ожидания результатов операций
    this.pendingPromises = new Map();
  }

  /**
   * Добавляет операцию в очередь
   * @param {string} type - тип операции: 'add' | 'read' | 'write'
   * @param {string} operation - название операции
   * @param {Object} data - данные операции
   * @param {number|null} itemId - ID элемента для дедупликации
   * @returns {Promise} промис, который разрешится после обработки операции
   */
  enqueue(type, operation, data, itemId = null) {
    return new Promise((resolve, reject) => {
      // Проверка дедупликации
      if ((type === 'write' || type === 'add') && itemId !== null) {
        if (this.lastProcessedIds.has(itemId)) {
          // Если этот ID уже обрабатывается, возвращаем промис от предыдущей операции
          const existingPending = this.pendingPromises.get(itemId);
          if (existingPending) {
            return existingPending.promise.then(resolve).catch(reject);
          }
        }
        // Помечаем ID как обрабатываемый и создаем общий промис для дедупликации
        this.lastProcessedIds.add(itemId);
        let promiseResolve, promiseReject;
        const sharedPromise = new Promise((res, rej) => {
          promiseResolve = res;
          promiseReject = rej;
        });
        this.pendingPromises.set(itemId, {
          promise: sharedPromise,
          resolve: promiseResolve,
          reject: promiseReject,
        });
      }

      const requestId = `${operation}_${Date.now()}_${Math.random()}`;
      const queueItem = {
        id: requestId,
        type,
        operation,
        data,
        itemId,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      // Добавляем в очередь
      if (type === 'add') {
        this.addQueue.push(queueItem);
      } else {
        this.readWriteQueue.push(queueItem);
      }
    });
  }

  /**
   * Получает батч добавления
   * @returns {Array} массив операций
   */
  getAddBatch() {
    const batch = [...this.addQueue];
    this.addQueue = [];
    return batch;
  }

  /**
   * Получает батч чтения/записи
   * @returns {Array} массив операций
   */
  getReadWriteBatch() {
    const batch = [...this.readWriteQueue];
    this.readWriteQueue = [];
    return batch;
  }

  /**
   * Очищает последний обработанный ID после успешной обработки
   * @param {number} itemId - ID элемента
   * @param {*} result - результат операции (для дедупликации)
   */
  clearProcessedId(itemId, result = null) {
    if (itemId !== null) {
      const pending = this.pendingPromises.get(itemId);
      if (pending) {
        // Разрешаем общий промис для всех запросов с этим ID (дедупликация)
        if (result !== null) {
          pending.resolve(result);
        }
        this.pendingPromises.delete(itemId);
      }
      this.lastProcessedIds.delete(itemId);
    }
  }

  /**
   * Отклоняет промис для ID при ошибке
   * @param {number} itemId - ID элемента
   * @param {Error} error - ошибка
   */
  rejectProcessedId(itemId, error) {
    if (itemId !== null) {
      const pending = this.pendingPromises.get(itemId);
      if (pending) {
        try {
          pending.reject(error);
        } catch (rejectError) {
          // Если отклонение промиса само по себе вызывает ошибку, логируем её
          // TODO: Понять, почему такое бывает
          console.error('Ошибка при отклонении общего промиса для дедупликации:', rejectError);
        }
        this.pendingPromises.delete(itemId);
      }
      this.lastProcessedIds.delete(itemId);
    }
  }

  /**
   * Разрешает промис для операции
   * @param {string} requestId - ID запроса
   * @param {*} result - результат операции
   */
  resolveRequest(requestId, result) {
    // Находим операцию в батчах
    const allQueues = [...this.addQueue, ...this.readWriteQueue];
    const item = allQueues.find((q) => q.id === requestId);
    if (item) {
      item.resolve(result);
      if (item.itemId) {
        this.clearProcessedId(item.itemId);
      }
    }
  }

  /**
   * Отклоняет промис для операции
   * @param {string} requestId - ID запроса
   * @param {Error} error - ошибка
   */
  rejectRequest(requestId, error) {
    const allQueues = [...this.addQueue, ...this.readWriteQueue];
    const item = allQueues.find((q) => q.id === requestId);
    if (item) {
      item.reject(error);
      if (item.itemId) {
        this.clearProcessedId(item.itemId);
      }
    }
  }
}

// Singleton экземпляр
export const requestQueue = new RequestQueue();
