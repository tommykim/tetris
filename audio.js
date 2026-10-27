/**
 * NEON TETRIS - Web Audio API Sound System
 * 외부 음원 파일 없이 순수 Web Audio API 오실레이터로 레트로 아케이드 효과음 및 BGM을 합성합니다.
 */

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.sfxEnabled = true;
    this.bgmEnabled = true;
    this.masterVolume = 0.6;
    this.bgmVolume = 0.25;
    this.sfxVolume = 0.7;

    this.masterGain = null;
    this.sfxGain = null;
    this.bgmGain = null;

    // BGM 스케줄러 관련
    this.isPlayingBGM = false;
    this.bgmTimer = null;
    this.bgmStep = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
      this.bgmGain.connect(this.masterGain);
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSFX() {
    this.sfxEnabled = !this.sfxEnabled;
    return this.sfxEnabled;
  }

  toggleBGM() {
    this.bgmEnabled = !this.bgmEnabled;
    if (this.bgmEnabled) {
      this.startBGM();
    } else {
      this.stopBGM();
    }
    return this.bgmEnabled;
  }

  // --- 효과음 (SFX) 구현 ---

  // 1. 블록 좌우 이동
  playMove() {
    if (!this.sfxEnabled) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.04);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // 2. 블록 회전
  playRotate() {
    if (!this.sfxEnabled) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.07);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  // 3. 소프트 드롭 (아래로 빠른 하강)
  playSoftDrop() {
    if (!this.sfxEnabled) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.03);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.03);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  // 4. 하드 드롭 (바닥 강타 묵직한 타격음)
  playHardDrop() {
    if (!this.sfxEnabled) return;
    this.init();
    const now = this.ctx.currentTime;

    // 킥 톤
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.13);

    // 노이즈 스냅
    this.playNoise(0.06, 0.25);
  }

  // 보조 노이즈 생성기
  playNoise(duration, volume) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
  }

  // 5. 블록 홀드(Hold)
  playHold() {
    if (!this.sfxEnabled) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.setValueAtTime(640, now + 0.04);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // 6. 라인 제거 (줄 수에 따른 화려한 아르페지오)
  playLineClear(lines) {
    if (!this.sfxEnabled) return;
    this.init();
    const now = this.ctx.currentTime;

    // 4줄(테트리스)일 때는 팡파레
    if (lines >= 4) {
      this.playTetrisClear();
      return;
    }

    // 1~3줄: 경쾌한 아르페지오
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const count = Math.min(lines + 1, 4);

    for (let i = 0; i < count; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(notes[i], now + i * 0.06);

      gain.gain.setValueAtTime(0.25, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.06 + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.2);
    }
  }

  // 7. 4줄 테트리스 특별 축하 사운드
  playTetrisClear() {
    const now = this.ctx.currentTime;
    const chords = [
      [523.25, 659.25, 783.99], // C Major
      [587.33, 739.99, 880.00], // D Major
      [659.25, 830.61, 987.77], // E Major
      [1046.50, 1318.51, 1567.98] // High C Major
    ];

    chords.forEach((chord, step) => {
      const startTime = now + step * 0.08;
      chord.forEach(freq => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.18, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(startTime);
        osc.stop(startTime + 0.28);
      });
    });
  }

  // 8. 레벨 업 사운드
  playLevelUp() {
    if (!this.sfxEnabled) return;
    this.init();
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);

      gain.gain.setValueAtTime(0.3, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.07 + 0.22);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.25);
    });
  }

  // 9. 게임 오버 사운드
  playGameOver() {
    if (!this.sfxEnabled) return;
    this.init();
    this.stopBGM();

    const now = this.ctx.currentTime;
    const notes = [440, 415.3, 392, 349.2, 311.1, 220]; // 슬픈 하강 음계

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);

      gain.gain.setValueAtTime(0.25, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.25);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.28);
    });
  }

  // --- 레트로 8비트 코로베이니키(Korobeiniki) BGM 엔진 ---
  startBGM() {
    if (!this.bgmEnabled || this.isPlayingBGM) return;
    this.init();
    this.isPlayingBGM = true;
    this.bgmStep = 0;
    this.scheduleBgmLoop();
  }

  stopBGM() {
    this.isPlayingBGM = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  scheduleBgmLoop() {
    if (!this.isPlayingBGM || !this.bgmEnabled) return;

    // 코로베이니키 멜로디 (주파수 Hz, 음길이 beat 단위)
    // 템포: 약 130 BPM (1비트 = 약 0.23초)
    const BEAT = 0.22;
    const melody = [
      // 파트 1
      { f: 659.25, d: 2 }, // E5
      { f: 493.88, d: 1 }, // B4
      { f: 523.25, d: 1 }, // C5
      { f: 587.33, d: 2 }, // D5
      { f: 523.25, d: 1 }, // C5
      { f: 493.88, d: 1 }, // B4
      { f: 440.00, d: 2 }, // A4
      { f: 440.00, d: 1 }, // A4
      { f: 523.25, d: 1 }, // C5
      { f: 659.25, d: 2 }, // E5
      { f: 587.33, d: 1 }, // D5
      { f: 523.25, d: 1 }, // C5
      { f: 493.88, d: 3 }, // B4
      { f: 523.25, d: 1 }, // C5
      { f: 587.33, d: 2 }, // D5
      { f: 659.25, d: 2 }, // E5
      { f: 523.25, d: 2 }, // C5
      { f: 440.00, d: 2 }, // A4
      { f: 440.00, d: 2 }, // A4
      { f: 0,      d: 2 }, // 쉬기

      // 파트 2
      { f: 587.33, d: 3 }, // D5
      { f: 698.46, d: 1 }, // F5
      { f: 880.00, d: 2 }, // A5
      { f: 783.99, d: 1 }, // G5
      { f: 698.46, d: 1 }, // F5
      { f: 659.25, d: 3 }, // E5
      { f: 523.25, d: 1 }, // C5
      { f: 659.25, d: 2 }, // E5
      { f: 587.33, d: 1 }, // D5
      { f: 523.25, d: 1 }, // C5
      { f: 493.88, d: 2 }, // B4
      { f: 493.88, d: 1 }, // B4
      { f: 523.25, d: 1 }, // C5
      { f: 587.33, d: 2 }, // D5
      { f: 659.25, d: 2 }, // E5
      { f: 523.25, d: 2 }, // C5
      { f: 440.00, d: 2 }, // A4
      { f: 440.00, d: 2 }, // A4
      { f: 0,      d: 2 }  // 쉬기
    ];

    const note = melody[this.bgmStep];
    const durationSec = note.d * BEAT;

    if (note.f > 0 && this.ctx) {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(note.f, now);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + durationSec * 0.9);

      // 로우패스 필터로 부드러운 8-bit 사운드 질감 부여
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain);

      osc.start(now);
      osc.stop(now + durationSec * 0.95);
    }

    this.bgmStep = (this.bgmStep + 1) % melody.length;

    this.bgmTimer = setTimeout(() => {
      this.scheduleBgmLoop();
    }, durationSec * 1000);
  }
}

// 글로벌 인스턴스
window.soundSystem = new SoundSystem();
