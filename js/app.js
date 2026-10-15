/**
 * Diary App Main Controller
 * ライフサイクル管理、イベント連携、テーマ切替、ビュー切替、トースト通知、サンプルデータ、PINロック
 */

import { db } from './db.js';
import { DiaryEditor, PROMPTS, MOODS } from './editor.js';
import { DiaryTimeline } from './timeline.js';
import { DiaryCalendar } from './calendar.js';
import { DiaryGallery } from './gallery.js';
import { OnThisDay } from './onThisDay.js';
import { DiaryStats } from './stats.js';
import { DiaryLock } from './lock.js';
import { DiaryAI } from './ai.js';

class DiaryApp {
  constructor() {
    this.currentView = 'timeline'; // 'timeline' | 'calendar' | 'gallery' | 'stats'
    this.currentFilter = {
      query: '',
      mood: '',
      tag: ''
    };

    this.currentPromptIndex = 0;
    this.editor = null;
    this.timeline = null;
    this.calendar = null;
    this.gallery = null;
    this.onThisDay = null;
    this.stats = null;
    this.lock = null;
    this.ai = null;

    this.init();
  }

  async init() {
    this.initTheme();
    this.initElements();
    this.initPromptBanner();

    // AI機能の初期化
    this.ai = new DiaryAI({
      onCommentReady: () => {}
    });

    // ロック機能の初期化
    this.lock = new DiaryLock({
      onUnlock: () => {
        this.showToast('手帳のロックを解除しました ✨');
      }
    });

    // データベース初期化
    try {
      await db.init();
    } catch (err) {
      console.error('Database init failed:', err);
      this.showToast('データベースの初期化に失敗しました', 'error');
    }

    // エディタ初期化
    this.editor = new DiaryEditor({
      onSave: (entryData) => this.handleSaveEntry(entryData),
      onCancel: () => {}
    });

    // タイムライン初期化
    this.timeline = new DiaryTimeline({
      containerId: 'timelineContainer',
      onEdit: (entry) => this.editor.open(entry),
      onDelete: (id) => this.handleDeleteEntry(id),
      onTagClick: (tag) => this.handleTagFilter(tag),
      onEmptyCreate: () => this.editor.open(null, PROMPTS[this.currentPromptIndex]),
      onAddSample: () => this.addSampleEntries(),
      onAiClick: (entry) => this.ai.generateReflection(entry)
    });

    // カレンダー初期化
    this.calendar = new DiaryCalendar({
      containerId: 'calendarContainer',
      onDateClick: () => {},
      onEntryClick: (entry) => this.editor.open(entry),
      onNewEntryForDate: (dateStr) => {
        this.editor.open({ date: dateStr }, PROMPTS[this.currentPromptIndex]);
      }
    });

    // ギャラリー初期化
    this.gallery = new DiaryGallery({
      containerId: 'galleryContainer',
      onPhotoClick: (src, entry) => {
        this.timeline.openLightbox(src);
      },
      onEntryClick: (entry) => this.editor.open(entry)
    });

    // 過去の今日（On This Day）初期化
    this.onThisDay = new OnThisDay({
      containerId: 'onThisDayContainer',
      onCardClick: (entry) => this.editor.open(entry)
    });

    // 統計・インサイト初期化
    this.stats = new DiaryStats({
      containerId: 'statsContainer'
    });

    this.attachEvents();
    await this.refreshAllViews();
  }

  initElements() {
    this.btnNewEntry = document.getElementById('btnNewEntry');
    this.btnThemeToggle = document.getElementById('btnThemeToggle');
    this.themeIcon = document.getElementById('themeIcon');
    this.searchInput = document.getElementById('searchInput');
    this.moodFilterContainer = document.getElementById('moodFilters');
    this.toastContainer = document.getElementById('toastContainer');

    // ビュー切り替えタブ
    this.viewTabs = document.querySelectorAll('.view-tab-btn');
    this.viewSections = {
      timeline: document.getElementById('viewSectionTimeline'),
      calendar: document.getElementById('viewSectionCalendar'),
      gallery: document.getElementById('viewSectionGallery'),
      stats: document.getElementById('viewSectionStats')
    };

    // お題バナー
    this.promptBanner = document.getElementById('promptBanner');
    this.promptText = document.getElementById('promptText');
    this.btnPromptWrite = document.getElementById('btnPromptWrite');
    this.btnPromptRefresh = document.getElementById('btnPromptRefresh');

    // エクスポート/インポート
    this.btnExport = document.getElementById('btnExport');
    this.btnImport = document.getElementById('btnImport');
    this.importFileInput = document.getElementById('importFileInput');
  }

  initTheme() {
    const savedTheme = localStorage.getItem('warm_diary_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('warm_diary_theme', next);
    this.themeIcon.textContent = next === 'dark' ? '☀️' : '🌙';
  }

  initPromptBanner() {
    this.currentPromptIndex = Math.floor(Math.random() * PROMPTS.length);
    this.updatePromptDisplay();
  }

  updatePromptDisplay() {
    this.promptText.textContent = PROMPTS[this.currentPromptIndex];
  }

  refreshPrompt() {
    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * PROMPTS.length);
    } while (nextIndex === this.currentPromptIndex && PROMPTS.length > 1);
    this.currentPromptIndex = nextIndex;
    this.updatePromptDisplay();
  }

  attachEvents() {
    // 新規作成ボタン（ヘッダー & モバイルFAB）
    const openNewDiary = () => {
      this.editor.open(null, PROMPTS[this.currentPromptIndex]);
    };
    if (this.btnNewEntry) {
      this.btnNewEntry.addEventListener('click', openNewDiary);
    }
    const mobileFab = document.getElementById('btnMobileFab');
    if (mobileFab) {
      mobileFab.addEventListener('click', openNewDiary);
    }

    // ビュー切り替えタブ
    this.viewTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        this.switchView(view);
      });
    });

    // テーマ切り替え
    this.btnThemeToggle.addEventListener('click', () => this.toggleTheme());
    const current = document.documentElement.getAttribute('data-theme');
    this.themeIcon.textContent = current === 'dark' ? '☀️' : '🌙';

    // お題から書く
    this.btnPromptWrite.addEventListener('click', () => {
      this.editor.open(null, PROMPTS[this.currentPromptIndex]);
    });

    // お題シャッフル
    this.btnPromptRefresh.addEventListener('click', () => this.refreshPrompt());

    // 検索入力（デバウンス）
    let debounceTimer = null;
    this.searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.currentFilter.query = e.target.value;
        this.refreshTimeline();
      }, 200);
    });

    // 気分フィルターボタン生成 & イベント
    this.renderMoodFilters();

    // エクスポート / インポート
    if (this.btnExport) {
      this.btnExport.addEventListener('click', () => this.exportData());
    }
    if (this.btnImport) {
      this.btnImport.addEventListener('click', () => this.importFileInput.click());
      this.importFileInput.addEventListener('change', (e) => this.handleImportFile(e));
    }
  }

  switchView(viewName) {
    if (!this.viewSections[viewName]) return;
    this.currentView = viewName;

    // タブのアクティブ状態更新
    this.viewTabs.forEach((tab) => {
      const isActive = tab.dataset.view === viewName;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // セクションの表示切り替え
    Object.keys(this.viewSections).forEach((name) => {
      if (this.viewSections[name]) {
        this.viewSections[name].classList.toggle('active', name === viewName);
      }
    });

    this.refreshAllViews();
  }

  renderMoodFilters() {
    this.moodFilterContainer.innerHTML = '';

    // 「すべて」ボタン
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = `mood-filter-btn ${!this.currentFilter.mood ? 'active' : ''}`;
    allBtn.innerHTML = '<span>🌈</span> すべて';
    allBtn.addEventListener('click', () => {
      this.currentFilter.mood = '';
      this.renderMoodFilters();
      this.refreshTimeline();
    });
    this.moodFilterContainer.appendChild(allBtn);

    // 各気分ボタン
    MOODS.forEach((m) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `mood-filter-btn ${this.currentFilter.mood === m.id ? 'active' : ''}`;
      btn.innerHTML = `<span>${m.emoji}</span> ${m.label}`;
      btn.addEventListener('click', () => {
        this.currentFilter.mood = this.currentFilter.mood === m.id ? '' : m.id;
        this.renderMoodFilters();
        this.refreshTimeline();
      });
      this.moodFilterContainer.appendChild(btn);
    });
  }

  handleTagFilter(tag) {
    if (this.currentFilter.tag === tag) {
      this.currentFilter.tag = '';
      this.showToast(`タグ「#${tag}」の絞り込みを解除しました`);
    } else {
      this.currentFilter.tag = tag;
      this.showToast(`タグ「#${tag}」で絞り込み中`);
    }
    this.refreshTimeline();
  }

  /**
   * 全ビューをリフレッシュ
   */
  async refreshAllViews() {
    try {
      const allEntries = await db.getAllEntries();

      // On This Day の更新
      if (this.onThisDay) {
        this.onThisDay.render(allEntries);
      }

      // タイムラインの更新（フィルター適用）
      await this.refreshTimeline();

      // カレンダーの更新
      if (this.calendar) {
        this.calendar.render(allEntries);
      }

      // ギャラリーの更新
      if (this.gallery) {
        this.gallery.render(allEntries);
      }

      // 統計の更新
      if (this.stats) {
        this.stats.render(allEntries);
      }
    } catch (err) {
      console.error('Failed to refresh views:', err);
    }
  }

  async refreshTimeline() {
    try {
      const entries = await db.searchEntries({
        query: this.currentFilter.query,
        mood: this.currentFilter.mood,
        tag: this.currentFilter.tag
      });
      this.timeline.render(entries);
    } catch (err) {
      console.error('Failed to load entries:', err);
      this.showToast('日記の読み込みに失敗しました', 'error');
    }
  }

  async handleSaveEntry(entryData) {
    try {
      await db.saveEntry(entryData);
      this.showToast('日記を大切に保存しました ✨', 'success');
      await this.refreshAllViews();
      this.refreshPrompt();
    } catch (err) {
      console.error('Failed to save entry:', err);
      this.showToast('保存中にエラーが発生しました', 'error');
    }
  }

  async handleDeleteEntry(id) {
    try {
      await db.deleteEntry(id);
      this.showToast('日記を削除しました', 'success');
      await this.refreshAllViews();
    } catch (err) {
      console.error('Failed to delete entry:', err);
      this.showToast('削除中にエラーが発生しました', 'error');
    }
  }

  showToast(message, type = 'normal') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '🌱' : type === 'error' ? '⚠️' : '💡';
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  async exportData() {
    try {
      const data = await db.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diary_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('バックアップファイルを書き出しました 📦', 'success');
    } catch (err) {
      console.error('Export failed:', err);
      this.showToast('エクスポートに失敗しました', 'error');
    }
  }

  async handleImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await db.importData(json);
      this.showToast('データを復元しました ✨', 'success');
      await this.refreshAllViews();
    } catch (err) {
      console.error('Import failed:', err);
      this.showToast('ファイルの読み込みに失敗しました。正しいJSONか確認してください', 'error');
    } finally {
      this.importFileInput.value = '';
    }
  }

  /**
   * 初回用サンプル日記の投入（直近の連続記録ストリーク＋1年前の思い出）
   */
  async addSampleEntries() {
    const makeSampleImage = (bg1, bg2, textEmoji, textLabel) => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
          <defs>
            <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="${bg1}" />
              <stop offset="100%" stop-color="${bg2}" />
            </linearGradient>
          </defs>
          <rect width="800" height="600" fill="url(#g)" rx="16"/>
          <circle cx="400" cy="270" r="100" fill="rgba(255,255,255,0.2)"/>
          <text x="400" y="300" font-size="90" text-anchor="middle" dominant-baseline="middle">${textEmoji}</text>
          <text x="400" y="440" font-family="sans-serif" font-size="28" font-weight="bold" fill="rgba(255,255,255,0.95)" text-anchor="middle">${textLabel}</text>
        </svg>
      `;
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    };

    const today = new Date();
    const formatDate = (daysAgo) => {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().split('T')[0];
    };

    // 1年前の今日
    const lastYearDate = new Date(today);
    lastYearDate.setFullYear(lastYearDate.getFullYear() - 1);
    const lastYearDateStr = lastYearDate.toISOString().split('T')[0];

    const samples = [
      {
        id: `sample_sports_${Date.now()}`,
        date: formatDate(0),
        time: '16:45',
        title: '息子の小学校 最後の運動会 🏃‍♂️🏅',
        content: '朝から抜けるような秋晴れ！息子の小学校生活最後の運動会。\n赤組のアンカーとして全力でトラックを駆け抜ける息子の姿を見て、思わず胸が熱くなった。\n入学した頃は小さかった背中が、いつの間にかたくましく大きくなっていて感動。\n手作りのお弁当も家族みんなで美味しく食べた。本当に素晴らしい一日だった！',
        mood: 'ecstatic',
        tags: ['運動会', '家族', '感謝', '成長'],
        prompt: '今日一番感動したこと、心に残ったシーンは？✨',
        albumUrl: 'https://photos.app.goo.gl/sports-day-sample-2026',
        albumTitle: 'Googleフォト：息子の運動会2026（写真84枚・高画質動画）',
        photos: [
          {
            id: 'p_sports1',
            name: 'sports_running.svg',
            dataUrl: makeSampleImage('#2b5876', '#4e4376', '🏃‍♂️', '全力のリレー')
          },
          {
            id: 'p_sports2',
            name: 'sports_medal.svg',
            dataUrl: makeSampleImage('#d4a373', '#a26738', '🏅', '金メダルと笑顔')
          }
        ],
        createdAt: Date.now()
      },
      {
        id: `sample_today_${Date.now()}`,
        date: formatDate(0),
        time: '14:20',
        title: 'お気に入りのカフェでひと息 ☕',
        content: '午後の散歩の途中で、路地裏にある静かなカフェを見つけた。\n自家焙煎のドリップコーヒーと、ほんのり温かいスコーンがとても美味しかった。\n\n窓際の席から見えるケヤキの木が少しずつ色づいていて、秋の深まりを感じる。\nゆっくりと本を読めて、心がふっと軽くなった時間。',
        mood: 'ecstatic',
        tags: ['カフェ', '散歩', 'ひとり時間'],
        prompt: 'いま一番心地いいと感じる場所や時間はどこですか？☕',
        photos: [
          {
            id: 'p1',
            name: 'cafe_coffee.svg',
            dataUrl: makeSampleImage('#6b4f4f', '#483434', '☕', '珈琲と静かな午後')
          },
          {
            id: 'p2',
            name: 'reading.svg',
            dataUrl: makeSampleImage('#4a6b5d', '#2c4339', '📖', '読書と秋の風')
          }
        ],
        createdAt: Date.now()
      },
      {
        id: `sample_yesterday_${Date.now()}`,
        date: formatDate(1),
        time: '21:45',
        title: '夕暮れの空がとても綺麗だった 🌇',
        content: '仕事帰りにふと見上げた空が、茜色から紫色の美しいグラデーションになっていた。\n立ち止まって深呼吸したら、今日の疲れが少し癒やされた気がする。\n明日は少し早起きして、美味しい朝ごはんを作ってみよう。',
        mood: 'happy',
        tags: ['日常', '感謝'],
        prompt: '今日頑張った自分に一言かけるなら、どんな言葉？💪',
        photos: [
          {
            id: 'p3',
            name: 'sunset.svg',
            dataUrl: makeSampleImage('#d9822b', '#7c3aed', '🌇', '茜色の夕暮れ')
          }
        ],
        createdAt: Date.now() - 86400000
      },
      {
        id: `sample_2days_ago_${Date.now()}`,
        date: formatDate(2),
        time: '20:10',
        title: '少し疲れたけれど、あたたかいスープを作った 🍲',
        content: '野菜をコトコト煮込んでポトフを作った。\n身体が芯から温まってほっとした。無理せず休むのも大切。',
        mood: 'neutral',
        tags: ['料理', '日常'],
        prompt: '今日美味しかった食べものは何ですか？🍽️',
        photos: [],
        createdAt: Date.now() - 86400000 * 2
      },
      {
        id: `sample_lastyear_${Date.now()}`,
        date: lastYearDateStr,
        time: '18:30',
        title: '新しい手帳を買った日 📖✨',
        content: '文房具屋さんで一目惚れした革の手帳を購入した。\nこれから毎日、小さな出来事や感じたことを書き留めていこうと決意。\n1年後の自分は何を考えているかな？',
        mood: 'ecstatic',
        tags: ['日常', '学び'],
        prompt: '明日やってみたいこと、楽しみにしていることは？🌱',
        photos: [
          {
            id: 'p4',
            name: 'notebook.svg',
            dataUrl: makeSampleImage('#3d5a80', '#293241', '📔', 'お気に入りの手帳')
          }
        ],
        createdAt: lastYearDate.getTime()
      }
    ];

    for (const sample of samples) {
      await db.saveEntry(sample);
    }

    this.showToast('連続ストリークと1年前の思い出を追加しました ✨', 'success');
    await this.refreshAllViews();
  }
}

// DOMContentLoaded で起動
window.addEventListener('DOMContentLoaded', () => {
  new DiaryApp();
});
