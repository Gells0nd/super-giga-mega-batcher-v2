<template>
  <div class="items-list">
    <h2>Все элементы</h2>

    <AddItemForm @item-added="handleItemAdded" />

    <div class="filter-section">
      <label for="filter-id">Фильтр по ID:</label>
      <input
        id="filter-id"
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
      <div v-else-if="items.length === 0" class="empty">Элементы не найдены</div>
      <div v-else class="items">
        <div v-for="item in items" :key="item.id" class="item">
          <div class="item-info">
            <span class="item-id">ID: {{ item.id }}</span>
            <span class="item-label">{{ item.label }}</span>
          </div>
          <button
            @click="handleAddToSelected(item.id)"
            :disabled="isAddingToSelected === item.id"
            class="add-button"
          >
            {{ isAddingToSelected === item.id ? 'Добавление...' : 'Добавить' }}
          </button>
        </div>
      </div>

      <div v-if="hasMore && !isLoading" ref="observerTarget" class="observer-target"></div>

      <div v-if="!hasMore && items.length > 0" class="end-message"> Все элементы загружены </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { getItems, addToSelected } from '../services/api';
import type { Item } from '../services/api';
import { useInfiniteScroll } from '../composables/useInfiniteScroll';
import AddItemForm from './AddItemForm.vue';

const emit = defineEmits<{
  itemAddedToSelected: [id: number];
}>();

const items = ref<Item[]>([]);
const currentPage = ref(1);
const totalItems = ref(0);
const isLoading = ref(false);
const isInitialLoad = ref(true);
const filterId = ref<number | null>(null);
const isAddingToSelected = ref<number | null>(null);
const listContainer = ref<HTMLElement | null>(null);

const limit = 20;

const hasMore = computed(() => {
  return items.value.length < totalItems.value;
});

// Дебаунсинг для фильтрации
let filterTimeout: ReturnType<typeof setTimeout> | null = null;

const handleFilterChange = () => {
  if (filterTimeout) {
    clearTimeout(filterTimeout);
  }

  filterTimeout = setTimeout(() => {
    resetAndLoad();
  }, 500);
};

const clearFilter = () => {
  filterId.value = null;
  resetAndLoad();
};

const resetAndLoad = async () => {
  items.value = [];
  currentPage.value = 1;
  isInitialLoad.value = true;
  await loadItems();
};

const loadItems = async () => {
  if (isLoading.value) return;

  isLoading.value = true;
  try {
    const response = await getItems(currentPage.value, limit, filterId.value);

    if (currentPage.value === 1) {
      items.value = response.items;
      isInitialLoad.value = false;
    } else {
      items.value.push(...response.items);
    }
    totalItems.value = response.total;
  } catch (error) {
    console.error('Ошибка загрузки элементов:', error);
  } finally {
    isLoading.value = false;
  }
};

const loadMore = async () => {
  if (!hasMore.value || isLoading.value) {
    console.log('loadMore пропущен:', { hasMore: hasMore.value, isLoading: isLoading.value });
    return;
  }
  console.log('Загрузка следующей страницы:', currentPage.value + 1);
  currentPage.value++;
  await loadItems();

  // Обновляем observer после загрузки
  await nextTick();
  updateObserver();
};

const handleAddToSelected = async (id: number) => {
  if (isAddingToSelected.value === id) return;

  isAddingToSelected.value = id;
  try {
    await addToSelected(id);
    emit('itemAddedToSelected', id);

    // TODO: Протестировать
    // Удаляем элемент из списка после добавления (оптимистичное обновление)
    items.value = items.value.filter((item) => item.id !== id);
  } catch (error) {
    // При ошибке можно будет обновить список, но пока не будем
  } finally {
    isAddingToSelected.value = null;
  }
};

const handleItemAdded = (item: Item) => {
  if (!filterId.value || item.id.toString().includes(filterId.value.toString())) {
    // Добавляем в начало списка, если это первая страница
    if (currentPage.value === 1) {
      items.value.unshift(item);
      totalItems.value++;
    } else {
      totalItems.value++;
    }
  }
};

const refresh = async () => {
  // Обновляем список без очистки (оптимистичное обновление)
  const savedFilter = filterId.value;
  const savedPage = currentPage.value;
  const savedItems = [...items.value];

  // При обновлении не показываем индикатор загрузки
  isInitialLoad.value = false;

  try {
    currentPage.value = 1;
    const response = await getItems(1, limit, savedFilter);

    // Заменяем данные только если загрузка успешна
    if (response.items && response.items.length > 0) {
      items.value = response.items;
      totalItems.value = response.total;
      currentPage.value = 1;
    } else if (savedItems.length > 0) {
      // Это может произойти из-за батчинга на сервере
      items.value = savedItems;
      currentPage.value = savedPage;
    }
  } catch (error) {
    console.error('Ошибка обновления списка:', error);
    // При ошибке оставляем старые данные
    if (savedItems.length > 0) {
      items.value = savedItems;
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
.items-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 2px solid #e2e8f0;
  padding: 1.5rem;
  background: #f5f7fa;
}

.items-list h2 {
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

.items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  transition: all 0.2s;
}

.item:hover {
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.1);
  border-color: #2563eb;
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

.add-button {
  padding: 0.625rem 1.25rem;
  background-color: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  white-space: nowrap;
  transition: background-color 0.2s;
}

.add-button:hover:not(:disabled) {
  background-color: #1d4ed8;
}

.add-button:disabled {
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
