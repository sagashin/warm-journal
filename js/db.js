/**
 * IndexedDB Database Module for Diary App
 * 写真や大容量テキストを安全・確実に永続化します。
 */

const DB_NAME = 'WarmDiaryDB';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

class DiaryDatabase {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  /**
   * データベースの初期化
   */
  async init() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('mood', 'mood', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });

    return this.initPromise;
  }

  /**
   * トランザクションヘルパー
   */
  async getStore(mode = 'readonly') {
    const db = await this.init();
    const tx = db.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  }

  /**
   * 全エントリーの取得（最新順）
   */
  async getAllEntries() {
    const store = await this.getStore('readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const entries = request.result || [];
        // 日付・作成日時の降順ソート
        entries.sort((a, b) => {
          const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          return (b.createdAt || 0) - (a.createdAt || 0);
        });
        resolve(entries);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 単一エントリーの取得
   */
  async getEntry(id) {
    const store = await this.getStore('readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * エントリーの保存（新規または更新）
   */
  async saveEntry(entry) {
    const store = await this.getStore('readwrite');
    const now = Date.now();

    const dataToSave = {
      ...entry,
      id: entry.id || `entry_${now}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: entry.createdAt || now,
      updatedAt: now
    };

    return new Promise((resolve, reject) => {
      const request = store.put(dataToSave);
      request.onsuccess = () => resolve(dataToSave);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * エントリーの削除
   */
  async deleteEntry(id) {
    const store = await this.getStore('readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 条件検索（フリーワード・気分・タグ・日付）
   */
  async searchEntries({ query = '', mood = '', tag = '', date = '' } = {}) {
    const all = await this.getAllEntries();
    const cleanQuery = query.trim().toLowerCase();

    return all.filter(entry => {
      if (mood && entry.mood !== mood) return false;
      if (tag && (!entry.tags || !entry.tags.includes(tag))) return false;
      if (date && entry.date !== date) return false;

      if (cleanQuery) {
        const inTitle = (entry.title || '').toLowerCase().includes(cleanQuery);
        const inContent = (entry.content || '').toLowerCase().includes(cleanQuery);
        const inPrompt = (entry.prompt || '').toLowerCase().includes(cleanQuery);
        const inTags = (entry.tags || []).some(t => t.toLowerCase().includes(cleanQuery));
        if (!inTitle && !inContent && !inPrompt && !inTags) return false;
      }
      return true;
    });
  }

  /**
   * 全データのJSONバックアップ取得
   */
  async exportData() {
    const entries = await this.getAllEntries();
    return {
      appName: 'WarmDiary',
      version: 1,
      exportedAt: new Date().toISOString(),
      entries
    };
  }

  /**
   * 外部JSONデータのインポート
   */
  async importData(data) {
    if (!data || !Array.isArray(data.entries)) {
      throw new Error('インポートデータの形式が不正です');
    }
    const store = await this.getStore('readwrite');
    for (const item of data.entries) {
      if (item && item.id) {
        await new Promise((resolve, reject) => {
          const req = store.put(item);
          req.onsuccess = resolve;
          req.onerror = reject;
        });
      }
    }
    return true;
  }
}

export const db = new DiaryDatabase();
