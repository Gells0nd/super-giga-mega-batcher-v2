<script setup lang="ts">
import { ref, onMounted } from 'vue';
import ItemsList from './components/ItemsList.vue';
import SelectedList from './components/SelectedList.vue';
import { useStateSync } from './composables/useStateSync';

const stateSync = useStateSync();
const itemsListRef = ref<InstanceType<typeof ItemsList> | null>(null);
const selectedListRef = ref<InstanceType<typeof SelectedList> | null>(null);
const selectedIds = ref<number[]>([]);

const handleItemAddedToSelected = async (id: number) => {
  selectedIds.value.push(id);
  await stateSync.saveState(selectedIds.value);

  // Обновляем список выбранных
  if (selectedListRef.value) {
    await selectedListRef.value.refresh();
  }

  // Не обновляем список всех элементов, так как элемент уже удален локально в handleAddToSelected
};

const handleItemRemoved = async (id: number) => {
  selectedIds.value = selectedIds.value.filter((selectedId) => selectedId !== id);
  await stateSync.saveState(selectedIds.value);

  // Обновляем список всех элементов
  if (itemsListRef.value) {
    await itemsListRef.value.refresh();
  }
};

const handleOrderChanged = async () => {
  // При изменении порядка выбранных элементов обновляем состояние
  await stateSync.saveState(selectedIds.value);

  // TODO: Подумать как будет лучше
  // Можно также обновить список всех элементов, если нужно
  // if (itemsListRef.value) {
  //   await itemsListRef.value.refresh();
  // }
};

onMounted(async () => {
  // Загружаем состояние при инициализации
  const loadedIds = await stateSync.loadState();
  selectedIds.value = loadedIds;

  // Обновляем список выбранных
  if (selectedListRef.value) {
    await selectedListRef.value.refresh();
  }

  // Обновляем список всех элементов
  if (itemsListRef.value) {
    await itemsListRef.value.refresh();
  }
});
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>Управление элементами</h1>
      <div v-if="stateSync.isLoading" class="loading-state">Загрузка состояния...</div>
      <div v-else-if="stateSync.error" class="error-state"> Ошибка: {{ stateSync.error }} </div>
    </header>

    <div v-if="stateSync.isInitialized" class="main-content">
      <ItemsList ref="itemsListRef" @item-added-to-selected="handleItemAddedToSelected" />
      <SelectedList
        ref="selectedListRef"
        @item-removed="handleItemRemoved"
        @order-changed="handleOrderChanged"
      />
    </div>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
}

#app {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
}

.app-header {
  padding: 1.5rem 2rem;
  background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
  color: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.app-header h1 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.5px;
}

.loading-state,
.error-state {
  margin-top: 0.75rem;
  font-size: 0.9rem;
  font-weight: 500;
}

.error-state {
  color: #fecaca;
}

.main-content {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
  }

  .items-list {
    border-right: none;
    border-bottom: 2px solid #e2e8f0;
  }
}
</style>
