/**
 * Diary Timeline Module
 * 手帳風タイムラインのレンダリング、写真グリッド、写真ライトボックス、アクション管理
 */

import { MOODS } from './editor.js';

export class DiaryTimeline {
  constructor({ containerId, onEdit, onDelete, onTagClick, onEmptyCreate, onAddSample, onAiClick }) {
    this.container = document.getElementById(containerId);
    this.onEdit = onEdit;
    this.onDelete = onDelete;
    this.onTagClick = onTagClick;
    this.onEmptyCreate = onEmptyCreate;
    this.onAddSample = onAddSample;
    this.onAiClick = onAiClick;

    this.lightboxOverlay = document.getElementById('lightboxOverlay');
    this.lightboxImg = document.getElementById('lightboxImg');
    this.lightboxClose = document.getElementById('lightboxClose');

    this.initLightbox();
  }

  initLightbox() {
    this.lightboxClose.addEventListener('click', () => this.closeLightbox());
    this.lightboxOverlay.addEventListener('click', (e) => {
      if (e.target === this.lightboxOverlay) this.closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeLightbox();
    });
  }

  openLightbox(src) {
    this.lightboxImg.src = src;
    this.lightboxOverlay.classList.add('active');
  }

  closeLightbox() {
    this.lightboxOverlay.classList.remove('active');
    setTimeout(() => {
      this.lightboxImg.src = '';
    }, 200);
  }

  /**
   * エントリー一覧の描画
   */
  render(entries) {
    this.container.innerHTML = '';

    if (!entries || entries.length === 0) {
      this.renderEmpty();
      return;
    }

    // タイムラインヘッダー（件数）
    const header = document.createElement('div');
    header.className = 'timeline-header';
    header.innerHTML = `
      <div class="timeline-title">
        <span>📖 日記の記録</span>
      </div>
      <div class="timeline-count">${entries.length} 件の思い出</div>
    `;
    this.container.appendChild(header);

    // エントリーカード生成
    entries.forEach((entry) => {
      const card = this.createEntryCard(entry);
      this.container.appendChild(card);
    });
  }

  /**
   * 空状態の描画
   */
  renderEmpty() {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-icon">📓</div>
      <h3 class="empty-title">まだ日記がありません</h3>
      <p class="empty-desc">今日のできごとや感じたこと、美味しかったご飯の写真を記録してみませんか？</p>
      <div class="empty-actions">
        <button type="button" class="btn-primary" id="btnEmptyCreate">
          <span>✏️</span> 最初の日記を書く
        </button>
        <button type="button" class="btn-secondary" id="btnEmptySample">
          <span>✨</span> サンプル日記を試す
        </button>
      </div>
    `;

    this.container.appendChild(empty);

    empty.querySelector('#btnEmptyCreate').addEventListener('click', () => {
      if (this.onEmptyCreate) this.onEmptyCreate();
    });

    empty.querySelector('#btnEmptySample').addEventListener('click', () => {
      if (this.onAddSample) this.onAddSample();
    });
  }

  /**
   * 1つの日記カードを生成
   */
  createEntryCard(entry) {
    const card = document.createElement('article');
    card.className = 'diary-card';
    card.dataset.id = entry.id;

    // 日付と曜日の解析
    const dateObj = new Date(entry.date + 'T00:00:00');
    const day = dateObj.getDate();
    const month = dateObj.getMonth() + 1;
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[dateObj.getDay()];

    // 気分の情報
    const moodObj = MOODS.find((m) => m.id === entry.mood) || MOODS[1];

    // カードヘッダー
    const top = document.createElement('div');
    top.className = 'card-top';

    top.innerHTML = `
      <div class="card-date-group">
        <div class="date-badge">
          <span class="date-day">${day}</span>
          <span class="date-month-weekday">${month}月 (${weekday})</span>
        </div>
        <div class="card-meta-text">
          <div class="card-mood-badge">
            <span>${moodObj.emoji}</span>
            <span>${moodObj.label}</span>
          </div>
          ${entry.time ? `<span class="card-time">${entry.time}</span>` : ''}
        </div>
      </div>
      <div class="card-actions">
        <button type="button" class="btn-card-action ai" title="AIの温かいひとこと">🌿</button>
        <button type="button" class="btn-card-action edit" title="編集">✏️</button>
        <button type="button" class="btn-card-action delete" title="削除">🗑️</button>
      </div>
    `;

    // AI・編集・削除イベント
    top.querySelector('.ai').addEventListener('click', () => {
      if (this.onAiClick) this.onAiClick(entry);
    });

    top.querySelector('.edit').addEventListener('click', () => {
      if (this.onEdit) this.onEdit(entry);
    });

    top.querySelector('.delete').addEventListener('click', () => {
      if (confirm('この日記を削除してもよろしいですか？')) {
        if (this.onDelete) this.onDelete(entry.id);
      }
    });

    card.appendChild(top);

    // お題（プロンプト）があれば引用バナー
    if (entry.prompt) {
      const promptElem = document.createElement('div');
      promptElem.className = 'card-prompt-quote';
      promptElem.textContent = `Q: ${entry.prompt}`;
      card.appendChild(promptElem);
    }

    // タイトル
    if (entry.title) {
      const titleElem = document.createElement('h3');
      titleElem.className = 'card-title';
      titleElem.textContent = entry.title;
      card.appendChild(titleElem);
    }

    // 本文
    if (entry.content) {
      const contentElem = document.createElement('div');
      contentElem.className = 'card-content';
      contentElem.textContent = entry.content;
      card.appendChild(contentElem);
    }

    // 写真グリッド
    if (entry.photos && entry.photos.length > 0) {
      const photosGrid = this.createPhotosGrid(entry.photos);
      card.appendChild(photosGrid);
    }

    // Googleフォト・外部アルバム連携カード
    if (entry.albumUrl) {
      const isGooglePhotos = entry.albumUrl.includes('photos.app.goo.gl') || entry.albumUrl.includes('photos.google.com');
      const albumCard = document.createElement('a');
      albumCard.className = `card-album-link ${isGooglePhotos ? 'google-photos' : ''}`;
      albumCard.href = entry.albumUrl;
      albumCard.target = '_blank';
      albumCard.rel = 'noopener noreferrer';
      albumCard.title = '別タブでアルバムを開く';

      const iconSvg = isGooglePhotos ? `
        <svg class="google-photos-svg" width="26" height="26" viewBox="0 0 24 24">
          <path fill="#EA4335" d="M12 6.5A5.5 5.5 0 0 1 17.5 12V6.5H12z"/>
          <path fill="#4285F4" d="M6.5 12A5.5 5.5 0 0 1 12 6.5H6.5V12z"/>
          <path fill="#34A853" d="M12 17.5A5.5 5.5 0 0 1 6.5 12v5.5H12z"/>
          <path fill="#FBBC04" d="M17.5 12A5.5 5.5 0 0 1 12 17.5h5.5V12z"/>
        </svg>
      ` : '<span style="font-size: 1.3rem;">🖼️</span>';

      albumCard.innerHTML = `
        <div class="album-card-left">
          <div class="album-card-icon-wrap">
            ${iconSvg}
          </div>
          <div class="album-card-text">
            <span class="album-card-badge">${isGooglePhotos ? 'Google フォト 共有アルバム' : '外部アルバム'}</span>
            <span class="album-card-title">${entry.albumTitle || 'アルバムの写真・動画を見る'}</span>
          </div>
        </div>
        <div class="album-card-action">
          <span>見る</span>
          <span class="album-card-arrow">↗</span>
        </div>
      `;
      card.appendChild(albumCard);
    }

    // タグ
    if (entry.tags && entry.tags.length > 0) {
      const tagsWrap = document.createElement('div');
      tagsWrap.className = 'card-tags';
      entry.tags.forEach((tag) => {
        const badge = document.createElement('span');
        badge.className = 'tag-badge';
        badge.textContent = `#${tag}`;
        badge.addEventListener('click', () => {
          if (this.onTagClick) this.onTagClick(tag);
        });
        tagsWrap.appendChild(badge);
      });
      card.appendChild(tagsWrap);
    }

    return card;
  }

  /**
   * 写真のグリッド生成
   */
  createPhotosGrid(photos) {
    const grid = document.createElement('div');
    const count = Math.min(photos.length, 4);
    grid.className = `card-photos-grid count-${count}`;

    photos.slice(0, 4).forEach((photo, idx) => {
      const thumb = document.createElement('div');
      thumb.className = 'photo-thumb';

      const img = document.createElement('img');
      img.src = photo.dataUrl;
      img.alt = photo.name || '日記の写真';
      img.loading = 'lazy';

      thumb.appendChild(img);

      // 4枚以上ある場合のオーバーレイ "+N"
      if (idx === 3 && photos.length > 4) {
        const overlay = document.createElement('div');
        overlay.className = 'photo-more-overlay';
        overlay.textContent = `+${photos.length - 3}`;
        thumb.appendChild(overlay);
      }

      thumb.addEventListener('click', () => {
        this.openLightbox(photo.dataUrl);
      });

      grid.appendChild(thumb);
    });

    return grid;
  }
}
