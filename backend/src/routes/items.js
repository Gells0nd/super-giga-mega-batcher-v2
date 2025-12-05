import express from 'express';
import { requestQueue } from '../services/RequestQueue.js';
import { itemStore } from '../models/ItemStore.js';

const router = express.Router();

/**
 * GET /
 * Проверка состояния сервера (heartbeat endpoint)
 * Возвращает статус 200 и сообщение о работоспособности сервиса.
 */
router.get('/', (req, res) => {
  return res.status(200).send({
    code: 200,
    status: 'Healthy!',
  });
});

/**
 * GET /api/items
 * Получение элементов для левого окна (все кроме выбранных)
 * Параметры: page, limit, filter (ID)
 */
router.get('/items', async (req, res) => {
  try {
    // TODO: Тут нарушается DRY, надо подумать как красиво вынести x1
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filterId = req.query.filter ? parseInt(req.query.filter) : null;

    if (page < 1) {
      return res.status(400).json({ error: 'page должен быть >= 1' });
    }
    if (limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'limit должен быть от 1 до 100' });
    }

    // Добавляем в очередь
    const result = await requestQueue.enqueue('read', 'getAll', { page, limit, filterId }, null);

    res.status(200).json(result);
  } catch (error) {
    console.error('Ошибка при получении элементов:', error);
    res.status(500).json({ error: error.message || 'Внутренняя ошибка сервера' });
  }
});

/**
 * GET /api/selected
 * Получение выбранных элементов для правого окна
 * Параметры: page, limit, filter (ID)
 */
router.get('/selected', async (req, res) => {
  try {
    // TODO: Тут нарушается DRY, надо подумать как красиво вынести x2
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filterId = req.query.filter ? parseInt(req.query.filter) : null;

    if (page < 1) {
      return res.status(400).json({ error: 'page должен быть >= 1' });
    }
    if (limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'limit должен быть от 1 до 100' });
    }

    // Добавляем запрос в очередь, батчинг 1 сек
    const result = await requestQueue.enqueue(
      'read',
      'getSelected',
      { page, limit, filterId },
      null,
    );

    res.json(result);
  } catch (error) {
    console.error('Ошибка при получении выбранных элементов:', error);
    res.status(500).json({ error: error.message || 'Внутренняя ошибка сервера' });
  }
});

/**
 * POST /api/items
 * Добавление нового элемента
 * Body: { id: number, label?: string }
 */
router.post('/items', async (req, res) => {
  try {
    const { id, label } = req.body;

    if (!id || typeof id !== 'number') {
      return res.status(400).json({ error: 'id обязателен и должен быть числом' });
    }
    if (id < 1) {
      return res.status(400).json({ error: 'id должен быть >= 1' });
    }
    if (label !== undefined && typeof label !== 'string') {
      return res.status(400).json({ error: 'label должен быть строкой' });
    }

    // Добавляем запрос в очередь, батчинг 10 сек
    // Дедупликация по ID
    const result = await requestQueue.enqueue('add', 'addItem', { id, label: label || null }, id);

    res.status(201).json(result);
  } catch (error) {
    console.error('Ошибка при добавлении элемента:', error);

    if (error.message && error.message.includes('уже существует')) {
      return res.status(409).json({ error: error.message });
    }

    res.status(500).json({ error: error.message || 'Внутренняя ошибка сервера' });
  }
});

/**
 * POST /api/selected
 * Добавление элемента в выбранные
 * Body: { id: number }
 */
router.post('/selected', async (req, res) => {
  try {
    const { id } = req.body;

    if (!id || typeof id !== 'number') {
      return res.status(400).json({ error: 'id обязателен и должен быть числом' });
    }

    // Добавляем запрос в очередь, батчинг 1 сек
    // Дедупликация по ID
    const result = await requestQueue.enqueue('write', 'addToSelected', { id }, id);

    res.json(result);
  } catch (error) {
    console.error('Ошибка при добавлении в выбранные:', error);
    res.status(500).json({ error: error.message || 'Внутренняя ошибка сервера' });
  }
});

/**
 * PUT /api/selected/order
 * Изменение порядка выбранных элементов (Drag&Drop)
 * Body: { id: number, newIndex: number }
 */
router.put('/selected/order', async (req, res) => {
  try {
    const { id, newIndex } = req.body;

    if (!id || typeof id !== 'number') {
      return res.status(400).json({ error: 'id обязателен и должен быть числом' });
    }
    if (newIndex === undefined || typeof newIndex !== 'number') {
      return res.status(400).json({ error: 'newIndex обязателен и должен быть числом' });
    }
    if (newIndex < 0) {
      return res.status(400).json({ error: 'newIndex должен быть >= 0' });
    }

    // Добавляем запрос в очередь, батчинг 1 сек
    // Дедупликация по ID
    const result = await requestQueue.enqueue('write', 'reorderSelected', { id, newIndex }, id);

    res.json(result);
  } catch (error) {
    console.error('Ошибка при изменении порядка:', error);
    res.status(500).json({ error: error.message || 'Внутренняя ошибка сервера' });
  }
});

/**
 * DELETE /api/selected/:id
 * Удаление элемента из выбранных
 */
router.delete('/selected/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'id должен быть числом' });
    }

    // Добавляем запрос в очередь, батчинг 1 сек
    // Дедупликация по ID
    const result = await requestQueue.enqueue('write', 'removeFromSelected', { id }, id);

    res.json(result);
  } catch (error) {
    console.error('Ошибка при удалении из выбранных:', error);
    res.status(500).json({ error: error.message || 'Внутренняя ошибка сервера' });
  }
});

/**
 * GET /api/state
 * Получение текущего состояния
 */
router.get('/state', async (req, res) => {
  try {
    // Читаем синхронно, что бы потом было проще
    const state = itemStore.getState();
    res.json(state);
  } catch (error) {
    console.error('Ошибка при получении состояния:', error);
    res.status(500).json({ error: error.message || 'Внутренняя ошибка сервера' });
  }
});

/**
 * POST /api/state
 * Восстановление состояния
 * Body: { selectedIds: number[] }
 */
router.post('/state', async (req, res) => {
  try {
    const { selectedIds } = req.body;
    const currentState = itemStore.getState();

    if (!Array.isArray(selectedIds)) {
      return res.status(400).json({ error: 'selectedIds должен быть массивом' });
    }

    // Проверяем, содержит ли приходящее состояние те же ID, что и текущее
    const incomingIdsSet = new Set(selectedIds);
    const currentIdsSet = new Set(currentState.selectedIds);

    // Это происходит в случае, если на сервере батчер уже обработал изменения, тогда просто отправляем как есть
    const sameIds =
      incomingIdsSet.size === currentIdsSet.size &&
      [...incomingIdsSet].every((id) => currentIdsSet.has(id));

    if (sameIds && JSON.stringify(selectedIds) !== JSON.stringify(currentState.selectedIds)) {
      return res.json({
        success: true,
        message: 'Состояние не изменено, используется актуальное состояние сервера',
      });
    }

    itemStore.setState({ selectedIds });
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при восстановлении состояния:', error);
    res.status(500).json({ error: error.message || 'Внутренняя ошибка сервера' });
  }
});

export default router;
