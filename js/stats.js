/**
 * Diary Statistics & Insights Module
 * 執筆ストリーク（連続日数）、気分分布、感情推移グラフ、執筆総数
 */

import { MOODS } from './editor.js';

export class DiaryStats {
  constructor({ containerId }) {
    this.container = document.getElementById(containerId);
  }

  /**
   * 統計情報を計算して描画
   * @param {Array} entries 全エントリー
   */
  render(entries = []) {
    if (!this.container) return;
    this.container.innerHTML = '';

    const stats = this.calculateStats(entries);

    const wrap = document.createElement('div');
    wrap.className = 'stats-wrap';

    // 1. サマリー指標カード（ストリーク、総エントリー、総文字数、写真総数）
    const summaryCards = document.createElement('div');
    summaryCards.className = 'stats-summary-grid';
    summaryCards.innerHTML = `
      <div class="stat-card streak">
        <div class="stat-icon">🔥</div>
        <div class="stat-content">
          <div class="stat-value">${stats.currentStreak}<span class="stat-unit">日連続</span></div>
          <div class="stat-label">現在の継続ストリーク</div>
        </div>
      </div>

      <div class="stat-card entries">
        <div class="stat-icon">📝</div>
        <div class="stat-content">
          <div class="stat-value">${stats.totalEntries}<span class="stat-unit">件</span></div>
          <div class="stat-label">書いた日記の総数</div>
        </div>
      </div>

      <div class="stat-card words">
        <div class="stat-icon">✍️</div>
        <div class="stat-content">
          <div class="stat-value">${stats.totalWords.toLocaleString()}<span class="stat-unit">文字</span></div>
          <div class="stat-label">綴った言葉の総文字数</div>
        </div>
      </div>

      <div class="stat-card photos">
        <div class="stat-icon">📷</div>
        <div class="stat-content">
          <div class="stat-value">${stats.totalPhotos}<span class="stat-unit">枚</span></div>
          <div class="stat-label">残した写真の枚数</div>
        </div>
      </div>
    `;
    wrap.appendChild(summaryCards);

    // 2. 気分の分布（バープログレス）
    const moodDistSection = document.createElement('div');
    moodDistSection.className = 'stats-section-card';
    moodDistSection.innerHTML = `
      <div class="section-card-title">
        <span>🌈 気分のバランス</span>
      </div>
      <div class="mood-dist-bars">
        ${this.renderMoodBars(stats.moodCounts, stats.totalEntries)}
      </div>
    `;
    wrap.appendChild(moodDistSection);

    // 3. 直近の気分の推移グラフ（SVG折れ線グラフ）
    const trendSection = document.createElement('div');
    trendSection.className = 'stats-section-card';
    trendSection.innerHTML = `
      <div class="section-card-title">
        <span>📈 直近の気分推移（最近の記録）</span>
      </div>
      <div class="mood-trend-chart-container">
        ${this.renderMoodTrendChart(entries)}
      </div>
    `;
    wrap.appendChild(trendSection);

    // 4. よく使うタグ上位
    const tagsSection = document.createElement('div');
    tagsSection.className = 'stats-section-card';
    tagsSection.innerHTML = `
      <div class="section-card-title">
        <span>🏷️ よく使うタグのランキング</span>
      </div>
      <div class="top-tags-cloud">
        ${this.renderTopTags(stats.tagCounts)}
      </div>
    `;
    wrap.appendChild(tagsSection);

    this.container.appendChild(wrap);
  }

  /**
   * 統計値の計算
   */
  calculateStats(entries) {
    const totalEntries = entries.length;
    let totalWords = 0;
    let totalPhotos = 0;
    const moodCounts = { ecstatic: 0, happy: 0, neutral: 0, cloudy: 0, tired: 0 };
    const tagCounts = {};

    entries.forEach((e) => {
      totalWords += (e.content || '').length + (e.title || '').length;
      totalPhotos += (e.photos || []).length;
      if (moodCounts[e.mood] !== undefined) {
        moodCounts[e.mood]++;
      }
      (e.tags || []).forEach((t) => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    });

    const currentStreak = this.calculateStreak(entries);

    return {
      totalEntries,
      totalWords,
      totalPhotos,
      moodCounts,
      tagCounts,
      currentStreak
    };
  }

  /**
   * 連続記録日数（Streak）の計算
   */
  calculateStreak(entries) {
    if (entries.length === 0) return 0;

    // 重複を除いた日付リスト（YYYY-MM-DD）の降順セット
    const dates = Array.from(new Set(entries.map((e) => e.date).filter(Boolean))).sort().reverse();
    if (dates.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const toDateStr = (d) => d.toISOString().split('T')[0];
    const todayStr = toDateStr(today);
    const yesterdayStr = toDateStr(yesterday);

    // 最新の記録が今日または昨日でなければストリークは0
    let checkDate;
    if (dates[0] === todayStr) {
      checkDate = new Date(today);
    } else if (dates[0] === yesterdayStr) {
      checkDate = new Date(yesterday);
    } else {
      return 0;
    }

    let streak = 0;
    const dateSet = new Set(dates);

    while (true) {
      const dStr = toDateStr(checkDate);
      if (dateSet.has(dStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * 気分バーのHTML生成
   */
  renderMoodBars(moodCounts, total) {
    if (total === 0) {
      return '<div class="stats-empty-note">まだ気分の記録がありません</div>';
    }

    return MOODS.map((m) => {
      const count = moodCounts[m.id] || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;

      return `
        <div class="mood-bar-item">
          <div class="mood-bar-label">
            <span class="mood-bar-emoji">${m.emoji}</span>
            <span class="mood-bar-name">${m.label}</span>
          </div>
          <div class="mood-bar-track">
            <div class="mood-bar-fill mood-${m.id}" style="width: ${pct}%"></div>
          </div>
          <div class="mood-bar-pct">${count}回 (${pct}%)</div>
        </div>
      `;
    }).join('');
  }

  /**
   * 気分推移グラフ（SVG）
   */
  renderMoodTrendChart(entries) {
    if (entries.length === 0) {
      return '<div class="stats-empty-note">日記を記録すると、ここに気分の推移グラフが表示されます</div>';
    }

    // 日付昇順で直近10件を抽出
    const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
    const recent = sorted.slice(-10);

    const moodScoreMap = {
      ecstatic: 5,
      happy: 4,
      neutral: 3,
      cloudy: 2,
      tired: 1
    };

    const width = 600;
    const height = 180;
    const padding = 40;

    const points = recent.map((item, idx) => {
      const x = padding + (idx / Math.max(recent.length - 1, 1)) * (width - padding * 2);
      const score = moodScoreMap[item.mood] || 3;
      // score 5 is top (padding), score 1 is bottom (height - padding)
      const y = height - padding - ((score - 1) / 4) * (height - padding * 2);
      return { x, y, item, score };
    });

    // パスデータ
    const pathD = points.reduce((acc, pt, i) => {
      return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');

    // 背景グリッド線
    const gridLines = [1, 2, 3, 4, 5].map((lvl) => {
      const y = height - padding - ((lvl - 1) / 4) * (height - padding * 2);
      const mood = MOODS[5 - lvl];
      return `
        <line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="var(--border-color)" stroke-dasharray="3,3" />
        <text x="${padding - 10}" y="${y + 4}" font-size="12" fill="var(--text-muted)" text-anchor="end">${mood.emoji}</text>
      `;
    }).join('');

    // 各ポイント
    const pointCircles = points.map((pt) => {
      const dateParts = pt.item.date.split('-');
      const label = `${parseInt(dateParts[1])}/${parseInt(dateParts[2])}`;
      return `
        <g class="chart-point-group">
          <circle cx="${pt.x}" cy="${pt.y}" r="6" fill="var(--color-primary)" stroke="var(--bg-card)" stroke-width="2" />
          <text x="${pt.x}" y="${height - 12}" font-size="11" fill="var(--text-muted)" text-anchor="middle">${label}</text>
        </g>
      `;
    }).join('');

    return `
      <svg viewBox="0 0 ${width} ${height}" class="mood-trend-svg" preserveAspectRatio="xMidYMid meet">
        ${gridLines}
        <path d="${pathD}" fill="none" stroke="var(--color-primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        ${pointCircles}
      </svg>
    `;
  }

  /**
   * よく使うタグランキング
   */
  renderTopTags(tagCounts) {
    const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
      return '<div class="stats-empty-note">タグを付けて日記を書くと、ここにランキングが表示されます</div>';
    }

    return sorted.slice(0, 10).map(([tag, count], idx) => `
      <div class="stat-tag-item">
        <span class="stat-tag-rank">#${idx + 1}</span>
        <span class="stat-tag-name">#${tag}</span>
        <span class="stat-tag-count">${count}回</span>
      </div>
    `).join('');
  }
}
