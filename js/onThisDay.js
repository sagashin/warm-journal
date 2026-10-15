/**
 * On This Day (過去の今日) Module
 * 過去の同じ月日（1年前、あるいは過去）の日記を抽出し、振り返りカードを生成します。
 */

import { MOODS } from './editor.js';

export class OnThisDay {
  constructor({ containerId, onCardClick }) {
    this.container = document.getElementById(containerId);
    this.onCardClick = onCardClick;
  }

  /**
   * 過去の今日の日記を検索
   * @param {Array} entries 全エントリー
   * @param {Date} targetDate 基準日（通常は今日）
   */
  findOnThisDayEntries(entries, targetDate = new Date()) {
    const currentMonth = targetDate.getMonth() + 1;
    const currentDay = targetDate.getDate();
    const currentYear = targetDate.getFullYear();

    return entries.filter(entry => {
      if (!entry.date) return false;
      const [year, month, day] = entry.date.split('-').map(Number);
      // 同じ月日で、かつ今年以外の過去（あるいは過去の年）
      return month === currentMonth && day === currentDay && year < currentYear;
    });
  }

  /**
   * 描画
   */
  render(entries) {
    if (!this.container) return;

    const matched = this.findOnThisDayEntries(entries);
    if (matched.length === 0) {
      this.container.style.display = 'none';
      this.container.innerHTML = '';
      return;
    }

    this.container.style.display = 'block';
    this.container.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'on-this-day-card';

    const entry = matched[0]; // 最も直近の過去の今日の思い出
    const entryYear = parseInt(entry.date.split('-')[0], 10);
    const yearsAgo = new Date().getFullYear() - entryYear;
    const moodObj = MOODS.find(m => m.id === entry.mood) || MOODS[1];

    card.innerHTML = `
      <div class="otd-header">
        <div class="otd-badge">
          <span>✨</span>
          <span>${yearsAgo}年前の今日 (${entryYear}年) の思い出</span>
        </div>
        <div class="otd-mood">${moodObj.emoji} ${moodObj.label}</div>
      </div>
      <div class="otd-body">
        <h4 class="otd-title">${entry.title || '無題の日記'}</h4>
        <p class="otd-snippet">${entry.content ? entry.content.slice(0, 100) + '...' : ''}</p>
        ${entry.photos && entry.photos.length > 0 ? `
          <div class="otd-photo-thumb">
            <img src="${entry.photos[0].dataUrl}" alt="思い出の写真">
          </div>
        ` : ''}
      </div>
      <div class="otd-footer">
        <button type="button" class="btn-otd-read">
          <span>📖</span> この日の日記を読む
        </button>
      </div>
    `;

    card.querySelector('.btn-otd-read').addEventListener('click', () => {
      if (this.onCardClick) this.onCardClick(entry);
    });

    this.container.appendChild(card);
  }
}
