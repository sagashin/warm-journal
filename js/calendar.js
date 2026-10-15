/**
 * Diary Calendar Module
 * 月間カレンダー表示、気分スタンプ、日付別日記プレビュー、過去日付の新規作成
 */

import { MOODS } from './editor.js';

export class DiaryCalendar {
  constructor({ containerId, onDateClick, onEntryClick, onNewEntryForDate }) {
    this.container = document.getElementById(containerId);
    this.onDateClick = onDateClick;
    this.onEntryClick = onEntryClick;
    this.onNewEntryForDate = onNewEntryForDate;

    this.currentDate = new Date();
    this.selectedDateStr = null;
    this.entriesMap = new Map(); // 'YYYY-MM-DD' => [entries]
  }

  /**
   * カレンダーを描画
   * @param {Array} entries 全日記エントリー
   */
  render(entries = []) {
    if (!this.container) return;

    // 日付マップを更新
    this.entriesMap.clear();
    entries.forEach((entry) => {
      if (!entry.date) return;
      if (!this.entriesMap.has(entry.date)) {
        this.entriesMap.set(entry.date, []);
      }
      this.entriesMap.get(entry.date).push(entry);
    });

    this.container.innerHTML = '';

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth(); // 0-indexed

    // カレンダーラッパー
    const wrap = document.createElement('div');
    wrap.className = 'calendar-wrap';

    // 1. カレンダーヘッダー（ナビゲーション）
    const header = document.createElement('div');
    header.className = 'calendar-nav-header';
    header.innerHTML = `
      <div class="calendar-current-month">
        <span class="cal-year">${year}年</span>
        <span class="cal-month">${month + 1}月</span>
      </div>
      <div class="calendar-nav-controls">
        <button type="button" class="btn-cal-nav" id="btnCalPrev" title="先月">◀</button>
        <button type="button" class="btn-cal-today" id="btnCalToday">今日</button>
        <button type="button" class="btn-cal-nav" id="btnCalNext" title="来月">▶</button>
      </div>
    `;

    // ナビゲーションイベント
    header.querySelector('#btnCalPrev').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.render(entries);
    });
    header.querySelector('#btnCalNext').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.render(entries);
    });
    header.querySelector('#btnCalToday').addEventListener('click', () => {
      this.currentDate = new Date();
      this.render(entries);
    });

    wrap.appendChild(header);

    // 2. 曜日ヘッダー
    const weekdaysRow = document.createElement('div');
    weekdaysRow.className = 'calendar-weekdays';
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    weekdays.forEach((day, idx) => {
      const col = document.createElement('div');
      col.className = `cal-weekday-cell ${idx === 0 ? 'sun' : idx === 6 ? 'sat' : ''}`;
      col.textContent = day;
      weekdaysRow.appendChild(col);
    });
    wrap.appendChild(weekdaysRow);

    // 3. 日付グリッド
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    // 月初・月末の計算
    const firstDay = new Date(year, month, 1).getDay(); // 月初の曜日 (0=日)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const todayStr = new Date().toISOString().split('T')[0];

    // 前月の端数マス
    for (let i = firstDay - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const cell = this.createDayCell(prevDate, false, todayStr);
      grid.appendChild(cell);
    }

    // 当月のマス
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const date = new Date(year, month, dayNum);
      const cell = this.createDayCell(date, true, todayStr);
      grid.appendChild(cell);
    }

    // 翌月の端数マス（合計マス数が7の倍数になるまで）
    const totalCells = firstDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const nextDate = new Date(year, month + 1, dayNum);
      const cell = this.createDayCell(nextDate, false, todayStr);
      grid.appendChild(cell);
    }

    wrap.appendChild(grid);

    // 4. 選択された日付の日記プレビューエリア
    const previewContainer = document.createElement('div');
    previewContainer.className = 'calendar-preview-container';
    previewContainer.id = 'calSelectedPreview';
    wrap.appendChild(previewContainer);

    this.container.appendChild(wrap);

    // デフォルトで今日または最新の日記の日付を選択表示
    if (!this.selectedDateStr) {
      this.selectedDateStr = todayStr;
    }
    this.updateSelectedPreview();
  }

  /**
   * 1つの日付セルを作成
   */
  createDayCell(dateObj, isCurrentMonth, todayStr) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const cell = document.createElement('div');
    cell.className = `cal-cell ${isCurrentMonth ? '' : 'outside'} ${dateStr === todayStr ? 'today' : ''} ${dateStr === this.selectedDateStr ? 'selected' : ''}`;
    cell.dataset.date = dateStr;

    const dayNumber = document.createElement('span');
    dayNumber.className = 'cal-cell-num';
    dayNumber.textContent = dateObj.getDate();
    cell.appendChild(dayNumber);

    const dayEntries = this.entriesMap.get(dateStr) || [];

    if (dayEntries.length > 0) {
      cell.classList.add('has-entry');
      const entry = dayEntries[0]; // その日の代表エントリー
      const moodObj = MOODS.find((m) => m.id === entry.mood) || MOODS[1];

      const indicator = document.createElement('div');
      indicator.className = 'cal-entry-indicator';
      indicator.innerHTML = `
        <span class="cal-mood-emoji">${moodObj.emoji}</span>
        ${entry.photos && entry.photos.length > 0 ? '<span class="cal-photo-dot" title="写真あり">📷</span>' : ''}
      `;
      cell.appendChild(indicator);
    }

    // クリックイベント
    cell.addEventListener('click', () => {
      this.container.querySelectorAll('.cal-cell').forEach((c) => c.classList.remove('selected'));
      cell.classList.add('selected');
      this.selectedDateStr = dateStr;
      this.updateSelectedPreview();

      if (this.onDateClick) {
        this.onDateClick(dateStr, dayEntries);
      }
    });

    return cell;
  }

  /**
   * 選択された日付のプレビュー更新
   */
  updateSelectedPreview() {
    const preview = this.container.querySelector('#calSelectedPreview');
    if (!preview || !this.selectedDateStr) return;

    const entries = this.entriesMap.get(this.selectedDateStr) || [];
    const dateObj = new Date(this.selectedDateStr + 'T00:00:00');
    const dateFormatted = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;

    preview.innerHTML = '';

    const previewHeader = document.createElement('div');
    previewHeader.className = 'cal-preview-header';
    previewHeader.innerHTML = `
      <div class="cal-preview-date">📅 ${dateFormatted} の記録</div>
      <button type="button" class="btn-cal-add" id="btnCalAddNew">
        <span>✏️</span> この日の日記を書く
      </button>
    `;

    previewHeader.querySelector('#btnCalAddNew').addEventListener('click', () => {
      if (this.onNewEntryForDate) {
        this.onNewEntryForDate(this.selectedDateStr);
      }
    });

    preview.appendChild(previewHeader);

    if (entries.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'cal-preview-empty';
      emptyMsg.textContent = 'この日の記録はまだありません。「この日の日記を書く」から思い出を綴ってみましょう。';
      preview.appendChild(emptyMsg);
    } else {
      const list = document.createElement('div');
      list.className = 'cal-preview-list';

      entries.forEach((entry) => {
        const item = document.createElement('div');
        item.className = 'cal-preview-item';
        const moodObj = MOODS.find((m) => m.id === entry.mood) || MOODS[1];

        item.innerHTML = `
          <div class="cal-item-top">
            <span class="cal-item-mood">${moodObj.emoji} ${moodObj.label}</span>
            <span class="cal-item-time">${entry.time || ''}</span>
          </div>
          <h4 class="cal-item-title">${entry.title || '無題の日記'}</h4>
          <p class="cal-item-snippet">${entry.content ? entry.content.slice(0, 80) + '...' : ''}</p>
          ${entry.photos && entry.photos.length > 0 ? `<div class="cal-item-photos">📷 ${entry.photos.length}枚の写真</div>` : ''}
        `;

        item.addEventListener('click', () => {
          if (this.onEntryClick) this.onEntryClick(entry);
        });

        list.appendChild(item);
      });

      preview.appendChild(list);
    }
  }
}
