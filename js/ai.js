/**
 * Diary AI Assistant Module (Gemini API & Smart Offline Reflection)
 * 日記に対する温かい共感、ポジティブなリフレーミング、深掘りの問いかけを生成
 */

const GEMINI_API_KEY_STORAGE = 'warm_diary_gemini_key';
const GEMINI_MODEL_STORAGE = 'warm_diary_gemini_model';

// 利用可能なGeminiモデル（優先順）
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-3.5-flash'
];

export class DiaryAI {
  constructor({ onCommentReady }) {
    this.onCommentReady = onCommentReady;
    this.apiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE) || '';
    this.activeModel = localStorage.getItem(GEMINI_MODEL_STORAGE) || CANDIDATE_MODELS[0];

    this.initElements();
    this.attachEvents();
  }

  cleanKey(key) {
    return (key || '')
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '');
  }

  initElements() {
    this.modal = document.getElementById('aiFeedbackModal');
    this.modalTitle = document.getElementById('aiModalTitle');
    this.contentTarget = document.getElementById('aiFeedbackContent');
    this.loadingElem = document.getElementById('aiFeedbackLoading');
    this.btnClose = document.getElementById('btnCloseAiModal');

    // APIキー設定用モーダル
    this.apiKeyModal = document.getElementById('aiKeySettingsModal');
    this.inputApiKey = document.getElementById('geminiApiKeyInput');
    this.btnSaveApiKey = document.getElementById('btnSaveApiKey');
    this.btnRemoveApiKey = document.getElementById('btnRemoveApiKey');
    this.btnCloseApiKeyModal = document.getElementById('btnCloseApiKeyModal');
    this.btnHeaderAi = document.getElementById('btnHeaderAi');

    // 新規要素: キー可視化・接続テスト
    this.btnToggleApiKeyVisibility = document.getElementById('btnToggleApiKeyVisibility');
    this.btnTestApiKey = document.getElementById('btnTestApiKey');
    this.testResultElem = document.getElementById('aiKeyTestResult');
  }

  attachEvents() {
    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.closeModal());
    }
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.closeModal();
      });
    }

    // APIキー設定
    if (this.btnHeaderAi) {
      this.btnHeaderAi.addEventListener('click', () => this.openKeySettings());
    }
    if (this.btnCloseApiKeyModal) {
      this.btnCloseApiKeyModal.addEventListener('click', () => this.closeKeySettings());
    }
    if (this.btnSaveApiKey) {
      this.btnSaveApiKey.addEventListener('click', () => this.saveApiKey());
    }
    if (this.btnRemoveApiKey) {
      this.btnRemoveApiKey.addEventListener('click', () => this.removeApiKey());
    }

    // パスワード表示切り替え
    if (this.btnToggleApiKeyVisibility && this.inputApiKey) {
      this.btnToggleApiKeyVisibility.addEventListener('click', () => {
        const isPassword = this.inputApiKey.type === 'password';
        this.inputApiKey.type = isPassword ? 'text' : 'password';
        this.btnToggleApiKeyVisibility.textContent = isPassword ? '🙈' : '👁️';
      });
    }

    // 接続テスト
    if (this.btnTestApiKey) {
      this.btnTestApiKey.addEventListener('click', () => this.testConnection());
    }
  }

  hasApiKey() {
    return Boolean(this.cleanKey(this.apiKey));
  }

  openKeySettings() {
    this.inputApiKey.value = this.apiKey;
    this.inputApiKey.type = 'password';
    if (this.btnToggleApiKeyVisibility) this.btnToggleApiKeyVisibility.textContent = '👁️';
    this.btnRemoveApiKey.style.display = this.hasApiKey() ? 'inline-flex' : 'none';
    if (this.testResultElem) {
      this.testResultElem.style.display = 'none';
      this.testResultElem.innerHTML = '';
    }
    this.apiKeyModal.classList.add('active');
  }

  closeKeySettings() {
    this.apiKeyModal.classList.remove('active');
  }

  showTestResult(message, type = 'info') {
    if (!this.testResultElem) return;
    this.testResultElem.className = `ai-key-test-result ${type}`;
    this.testResultElem.style.display = 'block';
    this.testResultElem.innerHTML = message;
  }

  /**
   * 接続テスト実行
   */
  async testConnection() {
    const rawKey = this.inputApiKey ? this.inputApiKey.value : this.apiKey;
    const key = this.cleanKey(rawKey);

    if (!key) {
      this.showTestResult('⚠️ APIキーが入力されていません。キーを入力してからテストしてください。', 'error');
      return;
    }

    this.showTestResult('⏳ Gemini APIへの接続をテスト中...', 'loading');
    if (this.btnTestApiKey) this.btnTestApiKey.disabled = true;

    try {
      const result = await this.testApiKey(key);
      if (result.success) {
        this.activeModel = result.model;
        localStorage.setItem(GEMINI_MODEL_STORAGE, result.model);
        this.showTestResult(`✅ 接続成功！Gemini API（モデル: <strong>${result.model}</strong>）と正常に通信できました。`, 'success');
      } else {
        this.showTestResult(`❌ 接続失敗: ${result.message}`, 'error');
      }
    } catch (err) {
      this.showTestResult(`❌ 通信エラー: ${this.formatErrorMessage(err)}`, 'error');
    } finally {
      if (this.btnTestApiKey) this.btnTestApiKey.disabled = false;
    }
  }

  /**
   * 単一キーでのAPI検証
   */
  async testApiKey(key) {
    const modelsToTry = [this.activeModel, ...CANDIDATE_MODELS.filter(m => m !== this.activeModel)];
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hello' }] }],
            generationConfig: { maxOutputTokens: 5 }
          })
        });

        if (response.ok) {
          return { success: true, model };
        }

        let errDetails = '';
        try {
          const errJson = await response.json();
          errDetails = errJson.error?.message || '';
        } catch (_) {}

        lastError = {
          status: response.status,
          message: errDetails || response.statusText,
          model
        };

        // モデル固有の404/403であれば次のモデルを試行
        if (response.status === 404 || (response.status === 403 && (errDetails.includes('model') || errDetails.includes('access')))) {
          continue;
        } else {
          // キー自体が無効(400)やクォータ枯渇(429)などの場合は即終了
          break;
        }
      } catch (err) {
        lastError = {
          status: 0,
          message: err.message || 'Network error',
          model
        };
        break;
      }
    }

    return {
      success: false,
      status: lastError?.status,
      message: this.formatErrorMessage(lastError)
    };
  }

  saveApiKey() {
    const rawKey = this.inputApiKey.value;
    const key = this.cleanKey(rawKey);

    if (!key) {
      alert('APIキーを入力してください。');
      return;
    }

    this.apiKey = key;
    localStorage.setItem(GEMINI_API_KEY_STORAGE, key);
    this.closeKeySettings();
    alert('Gemini APIキーを保存しました ✨\n日記を開いて「🌿」をタップすると高度なAIメッセージが届きます。');
  }

  removeApiKey() {
    if (!confirm('保存したAPIキーを削除しますか？')) return;
    this.apiKey = '';
    localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    if (this.inputApiKey) this.inputApiKey.value = '';
    this.closeKeySettings();
    alert('APIキーを削除しました。スマート共感モード（完全オフライン）で動作します。');
  }

  formatErrorMessage(err) {
    if (!err) return '不明なエラーが発生しました。';
    const status = err.status || 0;
    const msg = (err.message || '').toString();
    const details = (err.details || '').toString();

    if (status === 400 || msg.includes('API_KEY_INVALID') || details.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
      return '【APIキー無効 (400)】APIキーが正しく認識されませんでした。Google AI Studio (aistudio.google.com) で取得したキー（通常 AIzaSy... で始まります）を正しく貼り付けているか、余計な記号や空白がないかご確認ください。';
    }
    if (status === 403 || msg.includes('PERMISSION_DENIED') || details.includes('PERMISSION_DENIED')) {
      return '【アクセス権限エラー (403)】APIキーのアクセス制限（Webサイト制限・IP制限）が原因の可能性があります。Google Cloud ConsoleでAPIキーの制限を「なし」にするか、現在のサイトURLを許可してください。またGenerative Language APIが有効かご確認ください。';
    }
    if (status === 429 || msg.includes('RESOURCE_EXHAUSTED') || details.includes('RESOURCE_EXHAUSTED')) {
      return '【利用枠上限 (429)】APIの利用上限（無料枠のクォータ）に達しています。少し時間を置いてから再度お試しください。';
    }
    if (status === 404) {
      return '【モデル未対応 (404)】指定されたGeminiモデルがお使いのAPIキーまたはリージョンで利用できませんでした。';
    }
    if (status === 0 || msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror')) {
      return '【通信エラー】Googleサーバーとの通信に失敗しました。インターネット接続、またはブラウザの広告ブロック拡張機能・コンテンツブロッカー（AdGuard等）がGoogle APIを遮断していないかご確認ください。';
    }

    return `【エラー ${status || '通信障害'}】${details || msg}`;
  }

  /**
   * 日記に対するAIフィードバックの生成と表示
   */
  async generateReflection(entry) {
    // タイトルの二重アイコンを防ぐ
    this.modalTitle.textContent = `${entry.title || '今日の日記'} へのAIメッセージ`;
    this.contentTarget.innerHTML = '';
    this.loadingElem.style.display = 'flex';
    this.modal.classList.add('active');

    try {
      let result;
      if (this.hasApiKey()) {
        result = await this.callGeminiApi(entry);
      } else {
        // オフライン・スマート共感エンジン
        result = await this.generateSmartOfflineReflection(entry);
      }

      this.loadingElem.style.display = 'none';
      this.renderFeedbackResult(result, false);
    } catch (err) {
      console.warn('Gemini API call failed, falling back to smart reflection:', err);
      const fallback = await this.generateSmartOfflineReflection(entry);
      this.loadingElem.style.display = 'none';
      this.renderFeedbackResult(fallback, true, err);
    }
  }

  /**
   * Gemini API 呼び出し（複数モデルの自動フォールバック対応）
   */
  async callGeminiApi(entry) {
    const key = this.cleanKey(this.apiKey);
    if (!key) throw new Error('APIキーが設定されていません。');

    const prompt = `
あなたは優しく心に寄り添う親友のような日記アシスタントです。
以下の日記を読み、書いた人の心があたたかくなり、今日という日を肯定できるような返信を日本語で作成してください。

【日記データ】
日付: ${entry.date} (${entry.time || ''})
気分: ${entry.mood}
タイトル: ${entry.title || '無題'}
お題: ${entry.prompt || 'なし'}
本文:
${entry.content}
タグ: ${(entry.tags || []).join(', ')}

【回答フォーマット】
以下の3つのセクションで、やわらかく丁寧な言葉遣いで構成してください。
1. ✨ 共感とねぎらい（日記に書かれた具体的な出来事や気持ちを受け止めて優しく肯定）
2. 💡 心温まる視点・小さな発見（前向きになれる視点や、頑張りを褒める言葉）
3. 🌱 明日へのやさしい問いかけ（明日がちょっと楽しみになるような、プレッシャーのない小さな質問）
`;

    const modelsToTry = [this.activeModel, ...CANDIDATE_MODELS.filter(m => m !== this.activeModel)];
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 800
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            // 成功したモデルを記録
            this.activeModel = model;
            localStorage.setItem(GEMINI_MODEL_STORAGE, model);
            return {
              source: `Gemini (${model})`,
              text
            };
          }
        }

        let errDetails = '';
        try {
          const errJson = await response.json();
          errDetails = errJson.error?.message || '';
        } catch (_) {}

        lastError = {
          status: response.status,
          message: errDetails || response.statusText,
          model
        };

        // モデル未対応なら次のモデルへフォールバック
        if (response.status === 404 || (response.status === 403 && (errDetails.includes('model') || errDetails.includes('access')))) {
          console.info(`Model ${model} not available, trying next candidate...`);
          continue;
        } else {
          // キー自体のエラーなどはループ脱出
          break;
        }
      } catch (err) {
        lastError = {
          status: 0,
          message: err.message || '通信に失敗しました',
          model
        };
        break;
      }
    }

    const errorToThrow = new Error(this.formatErrorMessage(lastError));
    errorToThrow.status = lastError?.status;
    errorToThrow.details = lastError?.message;
    throw errorToThrow;
  }

  /**
   * スマート心理共感エンジン（キー不要・完全オフライン対応）
   */
  async generateSmartOfflineReflection(entry) {
    // 自然な思考ディレイ（500ms）
    await new Promise((resolve) => setTimeout(resolve, 500));

    const moodResponses = {
      ecstatic: [
        '最高に充実した素敵な一日でしたね！そのワクワクした気持ちが日記の言葉の端々から伝わってきます。',
        '心が満たされる瞬間をこうして言葉と写真に残せたこと、未来のあなたにとってもかけがえのない宝物になりますね。'
      ],
      happy: [
        '穏やかで温かい良い一日を過ごされたのですね。日常のささやかな幸せに気づけるあなたの感性がとても素敵です。',
        '心地よいリズムで一日を終えられたようで、私まであたたかい気持ちになりました。'
      ],
      neutral: [
        '大きな波風のない、平穏で落ち着いた一日。そんな何気ない日常の記録こそ、あとで読み返したときにとても愛おしく感じられるものです。',
        '今日も一日、自分のペースでしっかりと歩まれましたね。お疲れさまでした。'
      ],
      cloudy: [
        '少し心がもやもやする日、日記に素直な気持ちを吐き出せたのはとても素晴らしいセルフケアの一歩です。',
        '無理に元気を出す必要はありません。あたたかいお茶でも飲んで、今日は自分を一番に甘やかしてあげてくださいね。'
      ],
      tired: [
        '本当にお疲れさまでした！今日一日を最後まで乗り切ったご自身を、どうか思いっきり褒めてあげてください。',
        '身体も心もゆっくり休める時間を大切にしてくださいね。明日はきっと、今日よりも心が軽くなりますように。'
      ]
    };

    const moodList = moodResponses[entry.mood] || moodResponses.happy;
    const moodGreeting = moodList[Math.floor(Math.random() * moodList.length)];

    let keywordComment = '今日という日を大切に文字にして残されたことが、何より素晴らしいです。';
    const text = (entry.content + ' ' + (entry.title || '')).toLowerCase();

    if (text.includes('カフェ') || text.includes('珈琲') || text.includes('コーヒー')) {
      keywordComment = 'ほっと一息つけるカフェや珈琲の時間は、心をリセットする最高のご褒美ですね。';
    } else if (text.includes('散歩') || text.includes('空') || text.includes('風') || text.includes('花')) {
      keywordComment = '季節の移り変わりや空の美しさに目を向ける時間は、心をふっと軽くしてくれますね。';
    } else if (text.includes('仕事') || text.includes('勉強') || text.includes('頑張')) {
      keywordComment = '真摯に向き合って努力されている姿がとても眩しいです。自分の頑張りをしっかり認めてあげてくださいね。';
    } else if (text.includes('美味') || text.includes('ご飯') || text.includes('料理')) {
      keywordComment = '美味しいものを味わって食べることは、心と身体を整える最高のエネルギージェネレーターです。';
    }

    const formattedText = `
✨ **共感とねぎらい**
${moodGreeting}

💡 **心温まる視点**
${keywordComment}

🌱 **明日へのやさしい問いかけ**
明日、もし10分だけ自分のためだけに自由に使える時間があったら、どんな心地いいことをしてみたいですか？
`;

    return {
      source: 'スマート共感エンジン (Offline)',
      text: formattedText.trim()
    };
  }

  renderFeedbackResult(result, isFallback = false, error = null) {
    // バッジ
    const badge = document.createElement('div');
    badge.className = `ai-badge-source ${isFallback ? 'fallback' : (!this.hasApiKey() ? 'offline' : '')}`;
    badge.innerHTML = `<span>${isFallback ? '⚠️' : '✨'}</span> ${result.source}${isFallback ? ' (自動切替: オフライン共感モード)' : ''}`;

    this.contentTarget.appendChild(badge);

    // フォールバック時は理由と設定への誘導バナーを表示
    if (isFallback) {
      const alertBox = document.createElement('div');
      alertBox.className = 'ai-fallback-alert';
      alertBox.innerHTML = `
        <div class="ai-fallback-alert-title">
          <span>⚠️</span> Gemini API通信エラーのためオフラインで生成しました
        </div>
        <div class="ai-fallback-alert-reason">
          ${this.formatErrorMessage(error)}
        </div>
        <button type="button" class="btn-fallback-settings" id="btnOpenSettingsFromFallback">
          <span>⚙️</span> API設定を確認・テストする
        </button>
      `;

      alertBox.querySelector('#btnOpenSettingsFromFallback').addEventListener('click', () => {
        this.closeModal();
        this.openKeySettings();
        // 自動でテストを実行して何が問題かを表示
        setTimeout(() => this.testConnection(), 300);
      });

      this.contentTarget.appendChild(alertBox);
    }

    // 本文
    const body = document.createElement('div');
    body.className = 'ai-response-body';

    const escapeHtml = (str) => {
      return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const safeText = escapeHtml(result.text);
    const html = safeText
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');

    body.innerHTML = html;
    this.contentTarget.appendChild(body);
  }

  closeModal() {
    this.modal.classList.remove('active');
  }
}
