/**
 * Diary Gallery Module
 * 写真アルバム表示、写真ごとの日付・気分バッジ、ライトボックス拡大と日記ジャンプ
 */

import { MOODS } from './editor.js';

export class DiaryGallery {
  constructor({ containerId, onPhotoClick, onEntryClick }) {
    this.container = document.getElementById(containerId);
    this.onPhotoClick = onPhotoClick;
    this.onEntryClick = onEntryClick;
  }

  /**
   * ギャラリーを描画
   * @param {Array} entries 全日記エントリー
   */
  render(entries = []) {
    if (!this.container) return;
    this.container.innerHTML = '';

    // 写真を持つアイテムをフラットに抽出
    const photoItems = [];
    entries.forEach((entry) => {
      if (entry.photos && Array.isArray(entry.photos)) {
        entry.photos.forEach((photo) => {
          photoItems.push({
            photo,
            entry
          });
        });
      }
    });

    if (photoItems.length === 0) {
      this.renderEmpty();
      return;
    }

    // ギャラリーヘッダー
    const header = document.createElement('div');
    header.className = 'gallery-header';
    header.innerHTML = `
      <div class="gallery-title">
        <span>🖼️ 写真アルバム</span>
      </div>
      <div class="gallery-count">${photoItems.length} 枚の写真の思い出</div>
    `;
    this.container.appendChild(header);

    // グリッドコンテナ
    const grid = document.createElement('div');
    grid.className = 'gallery-grid';

    photoItems.forEach(({ photo, entry }) => {
      const card = document.createElement('div');
      card.className = 'gallery-card';

      const moodObj = MOODS.find((m) => m.id === entry.mood) || MOODS[1];
      const dateObj = new Date(entry.date + 'T00:00:00');
      const dateFormatted = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;

      card.innerHTML = `
        <div class="gallery-img-wrap">
          <img src="${photo.dataUrl}" alt="${photo.name || 'アルバム写真'}" loading="lazy">
          <div class="gallery-overlay">
            <div class="gallery-meta-top">
              <span class="gallery-date-badge">${dateFormatted}</span>
              <span class="gallery-mood-badge">${moodObj.emoji}</span>
            </div>
            <div class="gallery-meta-bottom">
              <span class="gallery-entry-title">${entry.title || '無題の日記'}</span>
            </div>
          </div>
        </div>
      `;

      // クリックで拡大ライトボックス表示
      card.querySelector('.gallery-img-wrap').addEventListener('click', (e) => {
        if (this.onPhotoClick) {
          this.onPhotoClick(photo.dataUrl, entry);
        }
      });

      grid.appendChild(card);
    });

    this.container.appendChild(grid);
  }

  renderEmpty() {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-icon">🖼️</div>
      <h3 class="empty-title">まだ写真がありません</h3>
      <p class="empty-desc">日記に思い出の写真やカフェのごはん、風景の写真を添付すると、ここにアルバムとしてコレクションされます。</p>
    `;
    this.container.appendChild(empty);
  }
}
