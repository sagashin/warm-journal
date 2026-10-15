/**
 * Diary Editor Module
 * 写真の最適化処理・気分選択・タグ・お題・バリデーション・自動下書き保存を担当
 */

import { formatLocalDate, formatLocalTime } from './dateUtils.js';

export const PROMPTS = [
  '今日一番美味しかった食べものは何ですか？🍽️',
  '今日、誰かに言われて嬉しかった言葉や感謝したいことは？✨',
  'いま一番心地いいと感じる場所や時間はどこですか？☕',
  '今日見つけた「小さな発見」や「季節の移り変わり」は？🍃',
  '最近夢中になっていること、気になっている本や動画は？📚',
  '今日頑張った自分に一言かけるなら、どんな言葉？💪',
  '今日あった出来事で、心がふっと軽くなった瞬間は？🌤️',
  '明日やってみたいこと、楽しみにしていることは？🌱'
];

export const MOODS = [
  { id: 'ecstatic', emoji: '😄', label: '最高' },
  { id: 'happy', emoji: '😊', label: '良い' },
  { id: 'neutral', emoji: '😐', label: '普通' },
  { id: 'cloudy', emoji: '🌧️', label: 'モヤモヤ' },
  { id: 'tired', emoji: '🥀', label: 'つかれた' }
];

export const PRESET_TAGS = [
  '日常', '感謝', 'カフェ', '散歩', '読書', '仕事', '料理', '学び', '旅行', 'ひとり時間'
];

const DRAFT_STORAGE_KEY = 'warm_diary_draft';

export class DiaryEditor {
  constructor({ onSave, onCancel }) {
    this.onSave = onSave;
    this.onCancel = onCancel;
    this.currentEntryId = null;
    this.currentPhotos = []; // { id, dataUrl, name }
    this.selectedMood = 'happy';
    this.selectedTags = new Set();
    this.currentPrompt = '';
    this.initialSnapshot = null;
    this.draftTimer = null;

    this.initElements();
    this.attachEvents();
  }

  initElements() {
    this.modal = document.getElementById('editorModal');
    this.modalTitle = document.getElementById('editorModalTitle');
    this.dateInput = document.getElementById('editorDate');
    this.timeInput = document.getElementById('editorTime');
    this.titleInput = document.getElementById('editorTitle');
    this.contentInput = document.getElementById('editorContent');
    this.charCount = document.getElementById('charCount');
    this.promptCard = document.getElementById('editorPromptCard');
    this.promptText = document.getElementById('editorPromptText');
    this.btnRemovePrompt = document.getElementById('btnRemovePrompt');

    // 下書き復元バナー
    this.draftBanner = document.getElementById('editorDraftBanner');
    this.btnDiscardDraft = document.getElementById('btnDiscardDraft');

    this.moodBtns = document.querySelectorAll('.mood-btn');
    this.photoDropzone = document.getElementById('photoDropzone');
    this.photoFileInput = document.getElementById('photoFileInput');
    this.photosPreview = document.getElementById('photosPreview');

    this.quickTagsContainer = document.getElementById('quickTagsContainer');
    this.customTagInput = document.getElementById('customTagInput');

    // アルバム連携入力
    this.albumUrlInput = document.getElementById('editorAlbumUrl');
    this.albumTitleInput = document.getElementById('editorAlbumTitle');

    this.btnSave = document.getElementById('btnSaveEntry');
    this.btnClose = document.getElementById('btnCloseEditor');
    this.btnCancel = document.getElementById('btnCancelEditor');
  }

  attachEvents() {
    // 閉じる & キャンセル（未保存の確認付き）
    this.btnClose.addEventListener('click', () => this.close());
    this.btnCancel.addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => {
      // 背景クリック時の誤タップ保護
      if (e.target === this.modal) this.close();
    });

    // ページ離脱時の保護
    window.addEventListener('beforeunload', (e) => {
      if (this.isOpen() && this.hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // 下書き破棄ボタン
    if (this.btnDiscardDraft) {
      this.btnDiscardDraft.addEventListener('click', () => {
        this.discardDraft();
      });
    }

    // 気分ボタン選択
    this.moodBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setMood(btn.dataset.mood);
        this.scheduleDraftSave();
      });
    });

    // 入力変更監視（自動下書き保存 & 文字数カウント）
    this.contentInput.addEventListener('input', () => {
      this.updateCharCount();
      this.scheduleDraftSave();
    });

    this.titleInput.addEventListener('input', () => {
      this.scheduleDraftSave();
    });

    this.dateInput.addEventListener('change', () => {
      this.scheduleDraftSave();
    });

    this.timeInput.addEventListener('change', () => {
      this.scheduleDraftSave();
    });

    if (this.albumUrlInput) {
      this.albumUrlInput.addEventListener('input', () => {
        this.scheduleDraftSave();
      });
    }

    if (this.albumTitleInput) {
      this.albumTitleInput.addEventListener('input', () => {
        this.scheduleDraftSave();
      });
    }

    // 写真選択
    this.photoDropzone.addEventListener('click', () => {
      this.photoFileInput.click();
    });

    this.photoFileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
      this.photoFileInput.value = ''; // リセット
    });

    // ドラッグ＆ドロップ
    this.photoDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.photoDropzone.classList.add('dragover');
    });

    ['dragleave', 'dragend'].forEach((type) => {
      this.photoDropzone.addEventListener(type, () => {
        this.photoDropzone.classList.remove('dragover');
      });
    });

    this.photoDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.photoDropzone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files) {
        this.handleFiles(e.dataTransfer.files);
      }
    });

    // お題削除
    this.btnRemovePrompt.addEventListener('click', () => {
      this.currentPrompt = '';
      this.promptCard.style.display = 'none';
      this.scheduleDraftSave();
    });

    // カスタムタグ追加
    this.customTagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const tag = this.customTagInput.value.trim().replace(/^#/, '');
        if (tag) {
          this.selectedTags.add(tag);
          this.customTagInput.value = '';
          this.renderTags();
          this.scheduleDraftSave();
        }
      }
    });

    // 保存ボタン
    this.btnSave.addEventListener('click', () => {
      this.save();
    });
  }

  isOpen() {
    return this.modal && this.modal.classList.contains('active');
  }

  /**
   * エディタを開く（新規または編集）
   */
  open(entry = null, defaultPrompt = '') {
    const now = new Date();
    const todayStr = formatLocalDate(now);
    const timeStr = formatLocalTime(now);

    if (entry && entry.id) {
      // 既存日記の編集モード
      this.currentEntryId = entry.id;
      this.modalTitle.textContent = '日記を編集';
      this.dateInput.value = entry.date || todayStr;
      this.timeInput.value = entry.time || timeStr;
      this.titleInput.value = entry.title || '';
      this.contentInput.value = entry.content || '';
      this.selectedMood = entry.mood || 'happy';
      this.selectedTags = new Set(entry.tags || []);
      this.currentPhotos = Array.isArray(entry.photos) ? [...entry.photos] : [];
      this.currentPrompt = entry.prompt || '';
      this.albumUrlInput.value = entry.albumUrl || '';
      this.albumTitleInput.value = entry.albumTitle || '';

      if (this.draftBanner) {
        this.draftBanner.style.display = 'none';
      }
    } else {
      // 新規作成モード
      this.currentEntryId = null;
      this.modalTitle.textContent = '新しい日記を書く';

      const draft = this.loadDraft();
      if (draft) {
        // 下書きがある場合は復元
        this.dateInput.value = draft.date || (entry?.date || todayStr);
        this.timeInput.value = draft.time || timeStr;
        this.titleInput.value = draft.title || '';
        this.contentInput.value = draft.content || '';
        this.selectedMood = draft.mood || 'happy';
        this.selectedTags = new Set(draft.tags || []);
        this.currentPhotos = Array.isArray(draft.photos) ? [...draft.photos] : [];
        this.currentPrompt = draft.prompt || defaultPrompt || '';
        this.albumUrlInput.value = draft.albumUrl || '';
        this.albumTitleInput.value = draft.albumTitle || '';

        if (this.draftBanner) {
          this.draftBanner.style.display = 'flex';
        }
      } else {
        // 新規まっさらな状態
        this.dateInput.value = entry?.date || todayStr;
        this.timeInput.value = timeStr;
        this.titleInput.value = '';
        this.contentInput.value = '';
        this.selectedMood = 'happy';
        this.selectedTags = new Set();
        this.currentPhotos = [];
        this.currentPrompt = defaultPrompt || '';
        this.albumUrlInput.value = '';
        this.albumTitleInput.value = '';

        if (this.draftBanner) {
          this.draftBanner.style.display = 'none';
        }
      }
    }

    // UI反映
    this.setMood(this.selectedMood);
    this.renderPrompt();
    this.renderTags();
    this.renderPhotosPreview();
    this.updateCharCount();

    // 変更検出用スナップショット
    this.takeInitialSnapshot();

    // 表示
    this.modal.classList.add('active');
    setTimeout(() => {
      if (!this.titleInput.value) {
        this.titleInput.focus();
      } else {
        this.contentInput.focus();
      }
    }, 100);
  }

  takeInitialSnapshot() {
    this.initialSnapshot = {
      title: this.titleInput.value.trim(),
      content: this.contentInput.value.trim(),
      date: this.dateInput.value,
      time: this.timeInput.value,
      mood: this.selectedMood,
      tagsCount: this.selectedTags.size,
      photosCount: this.currentPhotos.length,
      albumUrl: this.albumUrlInput ? this.albumUrlInput.value.trim() : '',
      albumTitle: this.albumTitleInput ? this.albumTitleInput.value.trim() : ''
    };
  }

  hasUnsavedChanges() {
    if (!this.initialSnapshot) return false;

    const curTitle = this.titleInput.value.trim();
    const curContent = this.contentInput.value.trim();
    const curAlbumUrl = this.albumUrlInput ? this.albumUrlInput.value.trim() : '';
    const curAlbumTitle = this.albumTitleInput ? this.albumTitleInput.value.trim() : '';

    if (!this.currentEntryId) {
      // 新規作成時は、何かしら入力されているかをチェック
      return Boolean(
        curTitle ||
        curContent ||
        this.currentPhotos.length > 0 ||
        curAlbumUrl ||
        curAlbumTitle
      );
    }

    // 編集時は開いた時との差分をチェック
    return (
      curTitle !== this.initialSnapshot.title ||
      curContent !== this.initialSnapshot.content ||
      this.dateInput.value !== this.initialSnapshot.date ||
      this.timeInput.value !== this.initialSnapshot.time ||
      this.selectedMood !== this.initialSnapshot.mood ||
      this.selectedTags.size !== this.initialSnapshot.tagsCount ||
      this.currentPhotos.length !== this.initialSnapshot.photosCount ||
      curAlbumUrl !== this.initialSnapshot.albumUrl ||
      curAlbumTitle !== this.initialSnapshot.albumTitle
    );
  }

  /**
   * エディタを閉じる（未保存変更がある場合は確認）
   * @param {boolean} force 
   */
  close(force = false) {
    if (!force && this.hasUnsavedChanges()) {
      const isNew = !this.currentEntryId;
      const msg = isNew
        ? '書きかけの内容があります。エディタを閉じますか？\n（入力内容は下書きとして保存され、次回自動で復元されます）'
        : '変更された内容があります。保存せずに閉じますか？';

      if (!confirm(msg)) {
        return;
      }
    }

    this.modal.classList.remove('active');
    if (this.onCancel) this.onCancel();
  }

  setMood(mood) {
    this.selectedMood = mood;
    this.moodBtns.forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.mood === mood);
    });
  }

  renderPrompt() {
    if (this.currentPrompt) {
      this.promptText.textContent = this.currentPrompt;
      this.promptCard.style.display = 'flex';
    } else {
      this.promptCard.style.display = 'none';
    }
  }

  renderTags() {
    this.quickTagsContainer.innerHTML = '';
    PRESET_TAGS.forEach((tag) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `quick-tag-chip ${this.selectedTags.has(tag) ? 'selected' : ''}`;
      chip.textContent = `#${tag}`;
      chip.addEventListener('click', () => {
        if (this.selectedTags.has(tag)) {
          this.selectedTags.delete(tag);
        } else {
          this.selectedTags.add(tag);
        }
        this.renderTags();
        this.scheduleDraftSave();
      });
      this.quickTagsContainer.appendChild(chip);
    });

    // プリセット以外のカスタムタグも表示
    this.selectedTags.forEach((tag) => {
      if (!PRESET_TAGS.includes(tag)) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'quick-tag-chip selected';
        chip.textContent = `#${tag} ×`;
        chip.addEventListener('click', () => {
          this.selectedTags.delete(tag);
          this.renderTags();
          this.scheduleDraftSave();
        });
        this.quickTagsContainer.appendChild(chip);
      }
    });
  }

  /**
   * 画像ファイルの処理 & 最適化（長辺1200pxに圧縮リサイズ）
   */
  async handleFiles(files) {
    if (!files || !files.length) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;

      try {
        const optimizedDataUrl = await this.compressImage(file, 1200, 0.85);
        this.currentPhotos.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          name: file.name,
          dataUrl: optimizedDataUrl
        });
      } catch (err) {
        console.error('画像処理エラー:', err);
      }
    }
    this.renderPhotosPreview();
    this.scheduleDraftSave();
  }

  /**
   * 画像リサイズ・最適化
   */
  compressImage(file, maxDimension = 1200, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  renderPhotosPreview() {
    this.photosPreview.innerHTML = '';
    this.currentPhotos.forEach((photo, index) => {
      const item = document.createElement('div');
      item.className = 'preview-item';

      const img = document.createElement('img');
      img.src = photo.dataUrl;
      img.alt = photo.name || '添付写真';

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'preview-remove-btn';
      removeBtn.innerHTML = '✕';
      removeBtn.title = '写真を削除';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.currentPhotos.splice(index, 1);
        this.renderPhotosPreview();
        this.scheduleDraftSave();
      });

      item.appendChild(img);
      item.appendChild(removeBtn);
      this.photosPreview.appendChild(item);
    });
  }

  updateCharCount() {
    const len = this.contentInput.value.length;
    this.charCount.textContent = `${len} 文字`;
  }

  // --- 自動下書き保存 (Draft System) ---

  scheduleDraftSave() {
    // 新規作成中のみ自動保存（既存日記の編集中は不用意な上書きを避ける）
    if (this.currentEntryId) return;

    clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => {
      this.saveDraft();
    }, 400);
  }

  saveDraft() {
    if (this.currentEntryId) return;

    const title = this.titleInput.value;
    const content = this.contentInput.value;
    const albumUrl = this.albumUrlInput ? this.albumUrlInput.value : '';
    const albumTitle = this.albumTitleInput ? this.albumTitleInput.value : '';

    // すべて空なら下書きを削除
    if (!title.trim() && !content.trim() && this.currentPhotos.length === 0 && !albumUrl.trim() && !albumTitle.trim()) {
      this.clearDraft();
      return;
    }

    const draftData = {
      title,
      content,
      date: this.dateInput.value,
      time: this.timeInput.value,
      mood: this.selectedMood,
      tags: Array.from(this.selectedTags),
      prompt: this.currentPrompt,
      albumUrl,
      albumTitle,
      photos: this.currentPhotos,
      savedAt: Date.now()
    };

    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
    } catch (e) {
      // 写真のBase64等でLocalStorageの容量制限に達した場合は写真を除いてテキストを死守
      try {
        draftData.photos = [];
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
      } catch (err2) {
        console.warn('Draft auto-save failed:', err2);
      }
    }
  }

  loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (
        data &&
        (data.title || data.content || (data.photos && data.photos.length > 0) || data.albumUrl)
      ) {
        return data;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  clearDraft() {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    if (this.draftBanner) {
      this.draftBanner.style.display = 'none';
    }
  }

  discardDraft() {
    if (!confirm('書きかけの下書きを破棄して白紙に戻しますか？')) return;

    this.clearDraft();

    const now = new Date();
    this.dateInput.value = formatLocalDate(now);
    this.timeInput.value = formatLocalTime(now);
    this.titleInput.value = '';
    this.contentInput.value = '';
    this.selectedMood = 'happy';
    this.selectedTags = new Set();
    this.currentPhotos = [];
    this.currentPrompt = '';
    if (this.albumUrlInput) this.albumUrlInput.value = '';
    if (this.albumTitleInput) this.albumTitleInput.value = '';

    this.setMood(this.selectedMood);
    this.renderPrompt();
    this.renderTags();
    this.renderPhotosPreview();
    this.updateCharCount();
    this.takeInitialSnapshot();
  }

  /**
   * 保存処理
   */
  save() {
    const title = this.titleInput.value.trim();
    const content = this.contentInput.value.trim();
    const date = this.dateInput.value;
    const time = this.timeInput.value;

    const albumUrl = this.albumUrlInput ? this.albumUrlInput.value.trim() : '';
    const albumTitle = this.albumTitleInput ? this.albumTitleInput.value.trim() : '';

    if (!title && !content && this.currentPhotos.length === 0 && !albumUrl) {
      alert('タイトル、本文、写真、またはアルバムリンクのいずれかを入力してください。');
      return;
    }

    const entryData = {
      id: this.currentEntryId,
      date,
      time,
      title: title || (content ? content.slice(0, 24) + '...' : albumTitle ? albumTitle : '思い出の日記'),
      content,
      mood: this.selectedMood,
      tags: Array.from(this.selectedTags),
      photos: this.currentPhotos,
      prompt: this.currentPrompt,
      albumUrl: albumUrl || null,
      albumTitle: albumTitle || null
    };

    if (this.onSave) {
      this.onSave(entryData);
    }

    // 保存完了後は下書きを削除
    this.clearDraft();

    // 強制クローズ（未保存アラートを出さずに閉じる）
    this.close(true);
  }
}
