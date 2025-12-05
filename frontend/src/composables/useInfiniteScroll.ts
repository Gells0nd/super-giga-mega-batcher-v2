import { ref, onMounted, onUnmounted, type Ref } from 'vue';

// Композабл для инфинити скролла
export function useInfiniteScroll(
  loadMore: () => Promise<void>,
  isLoading: Ref<boolean>,
  hasMore: Ref<boolean>,
) {
  const observerTarget = ref<HTMLElement | null>(null);
  let observer: IntersectionObserver | null = null;

  const observe = () => {
    if (!observerTarget.value) {
      console.log('observerTarget не найден');
      return;
    }

    if (!hasMore.value) {
      console.log('hasMore = false, observer не создан');
      return;
    }

    if (isLoading.value) {
      console.log('isLoading = true, observer не создан');
      return;
    }

    if (observer) {
      observer.disconnect();
    }

    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        console.log('IntersectionObserver triggered:', {
          isIntersecting: entry.isIntersecting,
          hasMore: hasMore.value,
          isLoading: isLoading.value,
        });
        if (entry.isIntersecting && hasMore.value && !isLoading.value) {
          console.log('Запуск loadMore из observer');
          loadMore();
        }
      },
      {
        rootMargin: '100px', // Начинаем загрузку за 100px до конца списка
        threshold: 0.1,
      },
    );

    observer.observe(observerTarget.value);
    console.log('Observer создан и наблюдает за элементом');
  };

  onMounted(() => {
    observe();
  });

  onUnmounted(() => {
    if (observer) {
      observer.disconnect();
    }
  });

  // Пересоздаем observer при изменении состояния
  const updateObserver = () => {
    if (observer) {
      observer.disconnect();
    }
    observe();
  };

  return {
    observerTarget,
    updateObserver,
  };
}
