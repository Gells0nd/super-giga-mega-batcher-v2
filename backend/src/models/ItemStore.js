import { generateLabel } from '../utils/generateLabel.js';

/**
 * Хранилище элементов в памяти
 * Управляет всеми элементами и выбранными элементами
 */
class ItemStore {
  constructor() {
    this.items = new Map(); // id -> {id, label}
    this.selectedIds = [];
    this.initializeItems();
  }

  /**
   * Инициализирует 1 000 000 элементов
   */
  initializeItems() {
    console.log('Инициализация 1 000 000 элементов...');
    for (let id = 1; id <= 1_000_000; id++) {
      this.items.set(id, {
        id,
        label: generateLabel(),
      });
    }
    console.log('Инициализация завершена');
  }

  /**
   * Получает все элементы, исключая выбранные
   * @param {number} page - номер стрвницы (начиная с 1)
   * @param {number} limit - количество элементов на странице
   * @param {number|null} filterId - фильтр по ID (опционально)
   * @returns {{items: Array, total: number, page: number, limit: number}}
   */
  getAll(page = 1, limit = 20, filterId = null) {
    let itemsArray = Array.from(this.items.values())
      .filter(item => !this.selectedIds.includes(item.id));

    // Если получаем ID то отдаем его айтем
    if (filterId !== null) {
      itemsArray = itemsArray.filter(item =>
        item.id.toString().includes(filterId.toString()),
      );
    }

    // TODO: Подумать, надо оставить или нет
    // Сортирую по ID на всякий случай
    itemsArray.sort((a, b) => a.id - b.id);

    const total = itemsArray.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = itemsArray.slice(startIndex, endIndex);

    return {
      items: paginatedItems,
      total,
      page,
      limit,
    };
  }

  /**
   * Получает выбранные элементы в порядке сортировки
   * @param {number} page - номер страницы (начиная с 1)
   * @param {number} limit - количество элементов на странице
   * @param {number|null} filterId - фильтр по ID (опционально)
   * @returns {{items: Array, total: number, page: number, limit: number}}
   */
  getSelected(page = 1, limit = 20, filterId = null) {
    let selectedItems = this.selectedIds
      .map(id => this.items.get(id))
      .filter(item => item !== undefined);

    // Если получаем ID то отдаем его айтем
    if (filterId !== null) {
      selectedItems = selectedItems.filter(item =>
        item.id.toString().includes(filterId.toString()),
      );

      // Сохраняем порядок сортировки для отфильтрованного списка
      const filteredIds = selectedItems.map(item => item.id);
      selectedItems = this.selectedIds
        .filter(id => filteredIds.includes(id))
        .map(id => this.items.get(id))
        .filter(item => item !== undefined);
    }

    const total = selectedItems.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = selectedItems.slice(startIndex, endIndex);

    return {
      items: paginatedItems,
      total,
      page,
      limit,
    };
  }

  /**
   * Добавляет новый элемент
   * @param {number} id - ID элемента
   * @param {string|null} label - label элемента (опционально, сгенерируется автоматически)
   * @returns {{id: number, label: string}}
   */
  addItem(id, label = null) {
    if (this.items.has(id)) {
      throw new Error(`Элемент с ID ${id} уже существует`);
    }

    const newItem = {
      id,
      label: label || generateLabel(),
    };

    this.items.set(id, newItem);
    return newItem;
  }

  /**
   * Добавляет элемент в выбранные (в конец списка)
   * @param {number} id - ID элемента
   * @returns {boolean} true если успешно добавлен
   */
  addToSelected(id) {
    if (!this.items.has(id)) {
      throw new Error(`Элемент с ID ${id} не существует`);
    }

    if (this.selectedIds.includes(id)) {
      return false; // Уже выбран
    }

    this.selectedIds.push(id);
    return true;
  }

  /**
   * Удаляет элемент из выбранных
   * @param {number} id - ID элемента
   * @returns {boolean} true если успешно удален
   */
  removeFromSelected(id) {
    const index = this.selectedIds.indexOf(id);
    if (index === -1) {
      return false;
    }

    this.selectedIds.splice(index, 1);
    return true;
  }

  /**
   * Изменяет порядок выбранных элементов (для Drag&Drop)
   * @param {number} id - ID элемента для перемещения
   * @param {number} newIndex - новая позиция в массиве
   * @returns {boolean} true если успешно перемещен
   */
  reorderSelected(id, newIndex) {
    const currentIndex = this.selectedIds.indexOf(id);
    if (currentIndex === -1) {
      throw new Error(`Элемент с ID ${id} не найден в выбранных`);
    }

    // Если элемент уже на нужной позиции, ничего не делаем
    if (currentIndex === newIndex) {
      return true;
    }

    // TODO: Убрать / отделить логирование
    console.log(`Перемещение элемента ${id}: с позиции ${currentIndex} на позицию ${newIndex}`);
    console.log(`Массив до перемещения:`, [...this.selectedIds]);

    // Удаляем элемент из текущей позиции
    const removed = this.selectedIds.splice(currentIndex, 1)[0];

    // newIndex - это позиция в массиве после удаления элемента
    // Если newIndex > currentIndex, то после удаления позиция newIndex остается прежней
    // Если newIndex <= currentIndex, то позиция newIndex также остается прежней
    // (так как мы удалили элемент слева от newIndex)
    // Поэтому просто используем newIndex как есть
    this.selectedIds.splice(newIndex, 0, removed);

    console.log(`Массив после перемещения:`, [...this.selectedIds]);
    return true;
  }

  /**
   * Получает текущее состояние для сохранения
   * @returns {{selectedIds: Array}}
   */
  getState() {
    // Тут делаем копию что бы не заруинить соурс массив
    const state = {
      selectedIds: [...this.selectedIds],
    };
    return state;
  }

  /**
   * Восстанавливает состояние из сохраненного
   * @param {{selectedIds: Array}} state - сохраненное состояние
   */
  setState(state) {
    if (state && Array.isArray(state.selectedIds)) {
      // Проверяем, что все сущестаует
      const previousState = [...this.selectedIds];
      this.selectedIds = state.selectedIds.filter(id => this.items.has(id));
    }
  }
}

// Синглтон экземпляр
export const itemStore = new ItemStore();

