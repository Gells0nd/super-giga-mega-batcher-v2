/**
 * Генерирует случайную строку для label элемента
 * @returns {string} Случайная строка длиной 8-16 символов
 */
export function generateLabel() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const length = Math.floor(Math.random() * 9) + 8; // 8-16 символов
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
