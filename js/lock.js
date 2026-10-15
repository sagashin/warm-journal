/**
 * Diary Privacy & PIN Lock Module
 * 4桁PINコードロック、覗き見防止ブラー、キーパッドUI、パスコードハッシュ化
 */

const PIN_STORAGE_KEY = 'warm_diary_pin_hash';
const LOCK_STATE_KEY = 'warm_diary_is_locked';

export class DiaryLock {
  constructor({ onUnlock, onLockChange }) {
    this.onUnlock = onUnlock;
    this.onLockChange = onLockChange;
    this.inputBuffer = '';
    this.tempNewPin = '';

    this.initElements();
    this.attachEvents();
    this.checkInitialLock();
  }

  initElements() {
    this.lockScreen = document.getElementById('lockScreen');
    this.pinDots = document.querySelectorAll('.pin-dot');
    this.lockMessage = document.getElementById('lockMessage');
    this.keypadBtns = document.querySelectorAll('.keypad-btn');
    this.btnHeaderLock = document.getElementById('btnHeaderLock');
    this.settingsModal = document.getElementById('pinSettingsModal');

    // 設定モーダル内の要素
    this.inputCurrentPin = document.getElementById('settingCurrentPin');
    this.inputNewPin = document.getElementById('settingNewPin');
    this.inputConfirmPin = document.getElementById('settingConfirmPin');
    this.btnSavePin = document.getElementById('btnSavePinSetting');
    this.btnRemovePin = document.getElementById('btnRemovePinSetting');
    this.btnClosePinSettings = document.getElementById('btnClosePinSettings');
    this.pinSettingsStatus = document.getElementById('pinSettingsStatus');
    this.currentPinGroup = document.getElementById('currentPinGroup');
  }

  attachEvents() {
    // キーパッド入力
    this.keypadBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.key;
        if (val === 'backspace') {
          this.handleBackspace();
        } else if (val) {
          this.handleKeyInput(val);
        }
      });
    });

    // キーボード入力にも対応
    document.addEventListener('keydown', (e) => {
      if (!this.isLocked()) return;
      if (e.key >= '0' && e.key <= '9') {
        this.handleKeyInput(e.key);
      } else if (e.key === 'Backspace') {
        this.handleBackspace();
      }
    });

    // ヘッダーのロックボタン
    if (this.btnHeaderLock) {
      this.btnHeaderLock.addEventListener('click', () => {
        if (this.hasPin()) {
          this.lock();
        } else {
          this.openSettings();
        }
      });
    }

    // 設定モーダル
    if (this.btnClosePinSettings) {
      this.btnClosePinSettings.addEventListener('click', () => this.closeSettings());
    }
    if (this.btnSavePin) {
      this.btnSavePin.addEventListener('click', () => this.handleSavePinSetting());
    }
    if (this.btnRemovePin) {
      this.btnRemovePin.addEventListener('click', () => this.handleRemovePin());
    }
  }

  hasPin() {
    return Boolean(localStorage.getItem(PIN_STORAGE_KEY));
  }

  isLocked() {
    return this.lockScreen && this.lockScreen.classList.contains('active');
  }

  checkInitialLock() {
    if (this.hasPin()) {
      this.lock();
    } else {
      this.unlock();
    }
    this.updateHeaderButton();
  }

  updateHeaderButton() {
    if (!this.btnHeaderLock) return;
    if (this.hasPin()) {
      this.btnHeaderLock.title = '手帳を今すぐロック';
      this.btnHeaderLock.innerHTML = '<span>🔒</span>';
    } else {
      this.btnHeaderLock.title = 'パスコードロックを設定';
      this.btnHeaderLock.innerHTML = '<span>🔓</span>';
    }
  }

  lock() {
    this.inputBuffer = '';
    this.updateDots();
    this.lockMessage.textContent = '暗証番号を入力してください';
    this.lockMessage.classList.remove('error');
    this.lockScreen.classList.add('active');
    document.body.classList.add('app-locked');
  }

  unlock() {
    this.inputBuffer = '';
    this.updateDots();
    this.lockScreen.classList.remove('active');
    document.body.classList.remove('app-locked');
    if (this.onUnlock) this.onUnlock();
  }

  handleKeyInput(digit) {
    if (this.inputBuffer.length >= 4) return;
    this.inputBuffer += digit;
    this.updateDots();

    if (this.inputBuffer.length === 4) {
      setTimeout(() => this.verifyPin(), 50);
    }
  }

  handleBackspace() {
    if (this.inputBuffer.length > 0) {
      this.inputBuffer = this.inputBuffer.slice(0, -1);
      this.updateDots();
    }
  }

  updateDots() {
    const len = this.inputBuffer.length;
    this.pinDots.forEach((dot, idx) => {
      dot.classList.toggle('filled', idx < len);
    });
  }

  async hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`warm_salt_${pin}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async verifyPin() {
    const enteredHash = await this.hashPin(this.inputBuffer);
    const savedHash = localStorage.getItem(PIN_STORAGE_KEY);

    if (enteredHash === savedHash) {
      this.unlock();
    } else {
      // 失敗時のアニメーション
      this.shakeKeypad();
      this.lockMessage.textContent = '暗証番号が違います';
      this.lockMessage.classList.add('error');
      setTimeout(() => {
        this.inputBuffer = '';
        this.updateDots();
      }, 500);
    }
  }

  shakeKeypad() {
    const dotsWrap = document.querySelector('.pin-dots-wrap');
    if (dotsWrap) {
      dotsWrap.classList.add('shake');
      setTimeout(() => dotsWrap.classList.remove('shake'), 400);
    }
  }

  // --- 設定画面 ---

  openSettings() {
    const hasPin = this.hasPin();
    this.pinSettingsStatus.textContent = hasPin ? '現在パスコードロックが有効です' : 'パスコードは現在設定されていません';
    this.currentPinGroup.style.display = hasPin ? 'flex' : 'none';
    this.btnRemovePin.style.display = hasPin ? 'inline-flex' : 'none';

    this.inputCurrentPin.value = '';
    this.inputNewPin.value = '';
    this.inputConfirmPin.value = '';

    this.settingsModal.classList.add('active');
  }

  closeSettings() {
    this.settingsModal.classList.remove('active');
  }

  async handleSavePinSetting() {
    const hasPin = this.hasPin();
    const newPin = this.inputNewPin.value.trim();
    const confirmPin = this.inputConfirmPin.value.trim();

    if (!/^\d{4}$/.test(newPin)) {
      alert('新しい暗証番号は4桁の数字で入力してください。');
      return;
    }

    if (newPin !== confirmPin) {
      alert('新しい暗証番号の確認用入力が一致しません。');
      return;
    }

    if (hasPin) {
      const currentPin = this.inputCurrentPin.value.trim();
      const currentHash = await this.hashPin(currentPin);
      if (currentHash !== localStorage.getItem(PIN_STORAGE_KEY)) {
        alert('現在の暗証番号が正しくありません。');
        return;
      }
    }

    const newHash = await this.hashPin(newPin);
    localStorage.setItem(PIN_STORAGE_KEY, newHash);
    this.updateHeaderButton();
    this.closeSettings();
    alert('パスコードを設定しました。手帳が安全に保護されます ✨');
  }

  async handleRemovePin() {
    if (!confirm('パスコードロックを解除してもよろしいですか？')) return;

    const currentPin = this.inputCurrentPin.value.trim();
    const currentHash = await this.hashPin(currentPin);
    if (currentHash !== localStorage.getItem(PIN_STORAGE_KEY)) {
      alert('現在の暗証番号が正しくありません。');
      return;
    }

    localStorage.removeItem(PIN_STORAGE_KEY);
    this.updateHeaderButton();
    this.closeSettings();
    alert('パスコードロックを解除しました。');
  }
}
