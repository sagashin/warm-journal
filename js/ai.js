/**
 * Diary AI Assistant Module (Gemini API & Smart Offline Reflection)
 * 日記に対する温かい共感、ポジティブなリフレーミング、深掘りの問いかけを生成
 */

const GEMINI_API_KEY_STORAGE = 'warm_diary_gemini_key';

export class DiaryAI {
  constructor({ onCommentReady }) {
    this.onCommentReady = onCommentReady;
    this.apiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE) || '';

    this.initElements();
    this.attachEvents();
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
  }

  hasApiKey() {
    return Boolean(this.apiKey && this.apiKey.trim());
  }

  openKeySettings() {
    this.inputApiKey.value = this.apiKey;
    this.btnRemoveApiKey.style.display = this.hasApiKey() ? 'inline-flex' : 'none';
    this.apiKeyModal.classList.add('active');
  }

  closeKeySettings() {
    this.apiKeyModal.classList.remove('active');
  }

  saveApiKey() {
    const key = this.inputApiKey.value.trim();
    if (!key) {
      alert('APIキーを入力してください。');
      return;
    }
    this.apiKey = key;
    localStorage.setItem(GEMINI_API_KEY_STORAGE, key);
    this.closeKeySettings();
    alert('Gemini APIキーを保存しました ✨ 高度なAI共感アシスタントが有効になりました。');
  }

  removeApiKey() {
    if (!confirm('保存したAPIキーを削除しますか？')) return;
    this.apiKey = '';
    localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    this.closeKeySettings();
    alert('APIキーを削除しました。スマート共感モード（オフライン動作）で動作します。');
  }

  /**
   * 日記に対するAIフィードバックの生成と表示
   */
  async generateReflection(entry) {
    this.modalTitle.textContent = `🌿 ${entry.title || '今日の日記'} へのAIメッセージ`;
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
      this.renderFeedbackResult(result);
    } catch (err) {
      console.warn('Gemini API call failed, falling back to smart reflection:', err);
      const fallback = await this.generateSmartOfflineReflection(entry);
      this.loadingElem.style.display = 'none';
      this.renderFeedbackResult(fallback, true);
    }
  }

  /**
   * Gemini API 呼び出し
   */
  async callGeminiApi(entry) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;

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

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 600
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');

    return {
      source: 'Gemini AI',
      text
    };
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

  renderFeedbackResult(result, isFallback = false) {
    const badge = document.createElement('div');
    badge.className = 'ai-badge-source';
    badge.innerHTML = `<span>✨</span> ${result.source}${isFallback ? ' (自動切替)' : ''}`;

    const body = document.createElement('div');
    body.className = 'ai-response-body';

    // マークダウン風の簡易パース
    const html = result.text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');

    body.innerHTML = html;

    this.contentTarget.appendChild(badge);
    this.contentTarget.appendChild(body);
  }

  closeModal() {
    this.modal.classList.remove('active');
  }
}
