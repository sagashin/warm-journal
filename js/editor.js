/**
 * Diary Editor Module
 * 写真の最適化処理・気分選択・タグ・お題・バリデーションを担当
 */

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

export class DiaryEditor {
  constructor({ onSave, onCancel }) {
    this.onSave = onSave;
    this.onCancel = onCancel;
    this.currentEntryId = null;
    this.currentPhotos = []; // { id, dataUrl, name }
    this.selectedMood = 'happy';
    this.selectedTags = new Set();
    this.currentPrompt = '';

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

    this.moodBtns = document.querySelectorAll('.mood-btn');
    this.photoDropzone = document.getElementById('photoDropzone');
    this.photoFileInput = document.getElementById('photoFileInput');
    this.photosPreview = document.getElementById('photosPreview');

    this.quickTagsContainer = document.getElementById('quickTagsContainer');
    this.customTagInput = document.getElementById('customTagInput');

    this.btnSave = document.getElementById('btnSaveEntry');
    this.btnClose = document.getElementById('btnCloseEditor');
    this.btnCancel = document.getElementById('btnCancelEditor');
  }

  attachEvents() {
    // 閉じる & キャンセル
    this.btnClose.addEventListener('click', () => this.close());
    this.btnCancel.addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    // 気分ボタン選択
    this.moodBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setMood(btn.dataset.mood);
      });
    });

    // 文字数カウント
    this.contentInput.addEventListener('input', () => {
      this.updateCharCount();
    });

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
        }
      }
    });

    // 保存ボタン
    this.btnSave.addEventListener('click', () => {
      this.save();
    });
  }

  /**
   * エディタを開く（新規または編集）
   */
  open(entry = null, defaultPrompt = '') {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);

    if (entry) {
      // 既存編集
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
    } else {
      // 新規作成
      this.currentEntryId = null;
      this.modalTitle.textContent = '新しい日記を書く';
      this.dateInput.value = todayStr;
      this.timeInput.value = timeStr;
      this.titleInput.value = '';
      this.contentInput.value = '';
      this.selectedMood = 'happy';
      this.selectedTags = new Set();
      this.currentPhotos = [];
      this.currentPrompt = defaultPrompt || '';
    }

    // UI反映
    this.setMood(this.selectedMood);
    this.renderPrompt();
    this.renderTags();
    this.renderPhotosPreview();
    this.updateCharCount();

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

  close() {
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

  /**
   * 保存処理
   */
  save() {
    const title = this.titleInput.value.trim();
    const content = this.contentInput.value.trim();
    const date = this.dateInput.value;
    const time = this.timeInput.value;

    if (!title && !content && this.currentPhotos.length === 0) {
      alert('タイトル、本文、または写真を1つ以上入力してください。');
      return;
    }

    const entryData = {
      id: this.currentEntryId,
      date,
      time,
      title: title || (content ? content.slice(0, 24) + '...' : '写真の日記'),
      content,
      mood: this.selectedMood,
      tags: Array.from(this.selectedTags),
      photos: this.currentPhotos,
      prompt: this.currentPrompt
    };

    if (this.onSave) {
      this.onSave(entryData);
    }

    this.close();
  }
}
