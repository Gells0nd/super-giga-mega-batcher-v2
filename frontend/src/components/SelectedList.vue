<template>
  <div class="selected-list">
    <h2>Выбранные элементы</h2>

    <div class="filter-section">
      <label for="filter-selected-id">Фильтр по ID:</label>
      <input
        id="filter-selected-id"
        v-model.number="filterId"
        type="number"
        min="1"
        placeholder="Введите ID для фильтрации"
        @input="handleFilterChange"
      />
      <button v-if="filterId" @click="clearFilter" class="clear-filter">Очистить</button>
    </div>

    <div class="list-container" ref="listContainer">
      <div v-if="isLoading && items.length === 0" class="loading">Загрузка...</div>
      <div v-else-if="!isLoading && items.length === 0" class="empty">Нет выбранных элементов</div>
      <div v-else class="items-wrapper">
        <VueDraggableNext
          :list="items"
          :disabled="isReordering"
          item-key="id"
          @end="handleDragEnd"
          handle=".drag-handle"
          class="items"
        >
          <div v-for="element in items" :key="element.id" class="item">
            <div class="drag-handle" title="Перетащите для изменения порядка">⋮⋮</div>
            <div class="item-info">
              <span class="item-id">ID: {{ element.id }}</span>
              <span class="item-label">{{ element.label }}</span>
            </div>
            <button
              @click="handleRemove(element.id)"
              :disabled="isRemoving === element.id"
              class="remove-button"
            >
              {{ isRemoving === element.id ? 'Удаление...' : 'Удалить' }}
            </button>
          </div>
        </VueDraggableNext>

        <div v-if="hasMore && !isLoading" ref="observerTarget" class="observer-target"></div>

        <div v-if="!hasMore && items.length > 0" class="end-message">Все элементы загружены</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { VueDraggableNext } from 'vue-draggable-next';
import { getSelected, removeFromSelected, reorderSelected } from '../services/api';
import type { Item } from '../services/api';
import { useInfiniteScroll } from '../composables/useInfiniteScroll';

const emit = defineEmits<{
  itemRemoved: [id: number];
  orderChanged: [];
}>();

const items = ref<Item[]>([]);
const allItems = ref<Item[]>([]);
const currentPage = ref(1);
const totalItems = ref(0);
const isLoading = ref(false);
const isInitialLoad = ref(true);
const filterId = ref<number | null>(null);
const isRemoving = ref<number | null>(null);
const isReordering = ref(false);
const listContainer = ref<HTMLElement | null>(null);

const limit = 20;

const hasMore = computed(() => {
  return allItems.value.length < totalItems.value;
});

// Дебаунсинг для фильтрации
let filterTimeout: ReturnType<typeof setTimeout> | null = null;

const handleFilterChange = () => {
  if (filterTimeout) {
    clearTimeout(filterTimeout);
  }

  filterTimeout = setTimeout(() => {
    applyFilter();
  }, 500);
};

const clearFilter = () => {
  filterId.value = null;
  applyFilter();
};

const applyFilter = async () => {
  items.value = [];
  allItems.value = [];
  currentPage.value = 1;
  isInitialLoad.value = true;
  await loadItems();
};

const loadItems = async () => {
  if (isLoading.value) return;

  isLoading.value = true;
  try {
    const response = await getSelected(currentPage.value, limit, filterId.value);

    if (currentPage.value === 1) {
      // Первая страница - заменяем все данные
      allItems.value = Array.isArray(response.items) ? [...response.items] : [];
      items.value = Array.isArray(response.items) ? [...response.items] : [];
      isInitialLoad.value = false;
    } else {
      // Последующие страницы - добавляем к существующим
      if (Array.isArray(response.items)) {
        allItems.value.push(...response.items);
        items.value = [...allItems.value];
      }
    }
    totalItems.value = response.total || 0;
  } catch (error) {
    console.error('Ошибка загрузки выбранных элементов:', error);
  } finally {
    isLoading.value = false;
  }
};

const loadMore = async () => {
  if (!hasMore.value || isLoading.value) return;
  currentPage.value++;
  await loadItems();
};

const handleRemove = async (id: number) => {
  if (isRemoving.value === id) return;

  isRemoving.value = id;
  try {
    await removeFromSelected(id);
    emit('itemRemoved', id);
    // Удаляем элемент из списка
    items.value = items.value.filter((item) => item.id !== id);
    allItems.value = allItems.value.filter((item) => item.id !== id);
    totalItems.value--;
  } catch (error) {
    console.error('Ошибка удаления из выбранных:', error);
  } finally {
    isRemoving.value = null;
  }
};

const handleDragEnd = async (event: any) => {
  if (isReordering.value) return;

  const { oldIndex, newIndex } = event;
  if (oldIndex === newIndex) return;

  const item = items.value[newIndex];
  if (!item) {
    return;
  }

  isReordering.value = true;
  try {
    const currentIndexInAll = allItems.value.findIndex((i) => i.id === item.id);
    if (currentIndexInAll === -1) {
      throw new Error('Элемент не найден в полном списке');
    }

    const newIndexInAll = newIndex;

    await reorderSelected(item.id, newIndexInAll);

    const [movedItem] = allItems.value.splice(currentIndexInAll, 1);
    if (movedItem) {
      allItems.value.splice(newIndexInAll, 0, movedItem);
    }

    items.value = [...allItems.value];

    // Уведомляем родительский компонент об изменении порядка
    emit('orderChanged');
  } catch (error) {
    console.error('Ошибка изменения порядка:', error);
    await resetAndLoad();
  } finally {
    isReordering.value = false;
  }
};

const resetAndLoad = async () => {
  items.value = [];
  allItems.value = [];
  currentPage.value = 1;
  await loadItems();
};

const refresh = async () => {
  const savedFilter = filterId.value;
  const savedPage = currentPage.value;
  const savedItems = [...items.value];
  const savedAllItems = [...allItems.value];

  isInitialLoad.value = false;

  try {
    currentPage.value = 1;
    const response = await getSelected(1, limit, savedFilter);

    // Заменяем данные только если загрузка успешна
    if (response.items && Array.isArray(response.items) && response.items.length > 0) {
      allItems.value = [...response.items];
      items.value = [...response.items];
      totalItems.value = response.total || 0;
      currentPage.value = 1;
    } else if (savedItems.length > 0) {
      items.value = savedItems;
      allItems.value = savedAllItems;
      currentPage.value = savedPage;
    }
  } catch (error) {
    console.error('Ошибка обновления списка выбранных:', error);
    // При ошибке оставляем старые данные
    if (savedItems.length > 0) {
      items.value = savedItems;
      allItems.value = savedAllItems;
      currentPage.value = savedPage;
    }
  }

  await nextTick();
  updateObserver();
};

defineExpose({
  refresh,
});

const { observerTarget, updateObserver } = useInfiniteScroll(loadMore, isLoading, hasMore);

onMounted(async () => {
  await loadItems();
  await nextTick();
  updateObserver();
});

watch([filterId, items], () => {
  nextTick(() => {
    updateObserver();
  });
});
</script>

<style scoped>
.selected-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1.5rem;
  background: #f5f7fa;
}

.selected-list h2 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: #1e3a5f;
  font-size: 1.5rem;
  font-weight: 600;
}

.filter-section {
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.filter-section label {
  font-weight: 500;
  color: #1e3a5f;
  min-width: 120px;
}

.filter-section input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 1rem;
  background: white;
  color: #1e3a5f;
  transition: border-color 0.2s;
}

.filter-section input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.clear-filter {
  padding: 0.75rem 1.25rem;
  background-color: #dc2626;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background-color 0.2s;
}

.clear-filter:hover {
  background-color: #b91c1c;
}

.list-container {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  background: white;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e2e8f0;
}

.items-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  transition: all 0.2s;
  cursor: move;
}

.item:hover {
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.1);
  border-color: #2563eb;
}

.item.sortable-ghost {
  opacity: 0.5;
  background: #eff6ff;
  border-color: #2563eb;
}

.item.sortable-drag {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
  border-color: #2563eb;
}

.drag-handle {
  cursor: grab;
  color: #64748b;
  font-size: 1.4rem;
  user-select: none;
  padding: 0.5rem;
  line-height: 1;
}

.drag-handle:active {
  cursor: grabbing;
  color: #2563eb;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 1;
}

.item-id {
  font-weight: 600;
  color: #2563eb;
  font-size: 1rem;
}

.item-label {
  color: #475569;
  font-size: 0.9rem;
}

.remove-button {
  padding: 0.625rem 1.25rem;
  background-color: #dc2626;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  white-space: nowrap;
  transition: background-color 0.2s;
}

.remove-button:hover:not(:disabled) {
  background-color: #b91c1c;
}

.remove-button:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}

.loading,
.loading-more {
  text-align: center;
  padding: 2rem;
  color: #64748b;
  font-weight: 500;
}

.empty {
  text-align: center;
  padding: 2rem;
  color: #94a3b8;
  font-size: 1rem;
}

.end-message {
  text-align: center;
  padding: 1rem;
  color: #94a3b8;
  font-size: 0.9rem;
}

.observer-target {
  height: 1px;
}
</style>
