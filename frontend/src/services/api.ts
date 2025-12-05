const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface Item {
  id: number;
  label: string;
}

export interface PaginatedResponse {
  items: Item[];
  total: number;
  page: number;
  limit: number;
}

export interface State {
  selectedIds: number[];
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function getItems(
  page: number = 1,
  limit: number = 20,
  filterId: number | null = null,
): Promise<PaginatedResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (filterId !== null) {
    params.append('filter', filterId.toString());
  }

  const response = await fetch(`${API_BASE_URL}/items?${params}`);
  return handleResponse<PaginatedResponse>(response);
}

export async function getSelected(
  page: number = 1,
  limit: number = 20,
  filterId: number | null = null,
): Promise<PaginatedResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (filterId !== null) {
    params.append('filter', filterId.toString());
  }

  const response = await fetch(`${API_BASE_URL}/selected?${params}`);
  return handleResponse<PaginatedResponse>(response);
}

export async function addItem(id: number, label?: string): Promise<Item> {
  const response = await fetch(`${API_BASE_URL}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, label }),
  });
  return handleResponse<Item>(response);
}

export async function addToSelected(id: number): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/selected`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  });
  return handleResponse<{ success: boolean }>(response);
}

export async function removeFromSelected(id: number): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/selected/${id}`, {
    method: 'DELETE',
  });
  return handleResponse<{ success: boolean }>(response);
}

export async function reorderSelected(id: number, newIndex: number): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/selected/order`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, newIndex }),
  });
  return handleResponse<{ success: boolean }>(response);
}

export async function getState(): Promise<State> {
  const response = await fetch(`${API_BASE_URL}/state`);
  return handleResponse<State>(response);
}

export async function setState(selectedIds: number[]): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/state`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ selectedIds }),
  });
  return handleResponse<{ success: boolean }>(response);
}
