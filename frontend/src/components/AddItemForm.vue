<template>
  <div class="add-item-form">
    <h3>Добавить новый элемент</h3>
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="item-id">ID элемента:</label>
        <input
          id="item-id"
          v-model.number="itemId"
          type="number"
          min="1"
          required
          :disabled="isLoading"
          placeholder="Введите ID"
        />
      </div>
      <div class="form-group">
        <label for="item-label">Label (опционально):</label>
        <input
          id="item-label"
          v-model="itemLabel"
          type="text"
          :disabled="isLoading"
          placeholder="Введите label или оставьте пустым"
        />
      </div>
      <button type="submit" :disabled="isLoading || !itemId">
        {{ isLoading ? 'Добавление...' : 'Добавить' }}
      </button>
      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="success" class="success">Элемент успешно добавлен!</div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { addItem } from '../services/api';
import type { Item } from '../services/api';

const emit = defineEmits<{
  itemAdded: [item: Item];
}>();

const itemId = ref<number | null>(null);
const itemLabel = ref<string>('');
const isLoading = ref(false);
const error = ref<string | null>(null);
const success = ref(false);

const handleSubmit = async () => {
  if (!itemId.value) return;

  isLoading.value = true;
  error.value = null;
  success.value = false;

  try {
    const newItem = await addItem(itemId.value, itemLabel.value || undefined);
    emit('itemAdded', newItem);

    itemId.value = null;
    itemLabel.value = '';
    success.value = true;

    setTimeout(() => {
      success.value = false;
    }, 3000);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Ошибка при добавлении элемента';
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.add-item-form {
  padding: 1.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.add-item-form h3 {
  margin-top: 0;
  margin-bottom: 1.25rem;
  font-size: 1.25rem;
  color: #1e3a5f;
  font-weight: 600;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #1e3a5f;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 1rem;
  box-sizing: border-box;
  color: #1e3a5f;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-group input:disabled {
  background-color: #f1f5f9;
  cursor: not-allowed;
  color: #94a3b8;
}

button {
  width: 100%;
  padding: 0.875rem;
  background-color: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

button:hover:not(:disabled) {
  background-color: #1d4ed8;
}

button:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}

.error {
  margin-top: 0.75rem;
  color: #dc2626;
  font-size: 0.9rem;
  font-weight: 500;
  padding: 0.5rem;
  background: #fef2f2;
  border-radius: 4px;
}

.success {
  margin-top: 0.75rem;
  color: #059669;
  font-size: 0.9rem;
  font-weight: 500;
  padding: 0.5rem;
  background: #f0fdf4;
  border-radius: 4px;
}
</style>
