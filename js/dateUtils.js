/**
 * Date & Time Utilities for Warm Journal
 * 端末のローカルタイムゾーンに基づいた正確な日時文字列を提供します。
 */

/**
 * ローカル日付を YYYY-MM-DD 形式で取得
 * (toISOString() を使用するとUTC換算で日付が前日へズレる問題を防止)
 * @param {Date|string|number} date 
 * @returns {string} 'YYYY-MM-DD'
 */
export function formatLocalDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * ローカル時刻を HH:mm 形式で取得
 * @param {Date|string|number} date 
 * @returns {string} 'HH:mm'
 */
export function formatLocalTime(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
