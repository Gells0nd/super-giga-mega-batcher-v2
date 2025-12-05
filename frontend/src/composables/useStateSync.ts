import { ref } from 'vue';
import { getState, setState } from '../services/api';

const STATE_STORAGE_KEY = 'items-app-state';

// Композабл для синхронизации состояния с сервером
export function useStateSync() {
  const isInitialized = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const loadState = async (): Promise<number[]> => {
    isLoading.value = true;
    error.value = null;

    try {
      const state = await getState();

      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state.selectedIds));

      isInitialized.value = true;
      return state.selectedIds;
    } catch (err) {
      console.error('Ошибка загрузки состояния с сервера:', err);

      const savedState = localStorage.getItem(STATE_STORAGE_KEY);
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          // Востанавливаем состояние на сервере
          await setState(parsedState);
          isInitialized.value = true;
          return parsedState;
        } catch (parseError) {
          console.error('Ошибка парсинга сохраненного состояния:', parseError);
        }
      }

      error.value = err instanceof Error ? err.message : 'Неизвестная ошибка';
      isInitialized.value = true;
      return [];
    } finally {
      isLoading.value = false;
    }
  };

  const saveState = async (selectedIds: number[]): Promise<void> => {
    try {
      await setState(selectedIds);
      // Сохраняем в localStorage как fallback
      // TODO: Возможно стоит пересмотреть подход
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(selectedIds));
      error.value = null;
    } catch (err) {
      console.error('Ошибка сохранения состояния:', err);
      // Сохраняем в localStorage даже при ошибке
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(selectedIds));
      error.value = err instanceof Error ? err.message : 'Неизвестная ошибка';
    }
  };

  return {
    isInitialized,
    isLoading,
    error,
    loadState,
    saveState,
  };
}
