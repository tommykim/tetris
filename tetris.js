/**
 * NEON TETRIS - Core Game Engine
 * HTML5 Canvas 기반의 클래식 싱글 플레이어 테트리스
 */

// 테트로미노 데이터 (7-Piece definitions)
const TETROMINOES = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    color: '#00f0ff',
    glow: 'rgba(0, 240, 255, 0.7)'
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.7)'
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: '#f97316',
    glow: 'rgba(249, 115, 22, 0.7)'
  },
  O: {
    shape: [
      [1, 1],
      [1, 1]
    ],
    color: '#facc15',
    glow: 'rgba(250, 204, 21, 0.7)'
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],
    color: '#22c55e',
    glow: 'rgba(34, 197, 94, 0.7)'
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.7)'
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ],
    color: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.7)'
  }
};

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30; // 300x600 캔버스 기준

class TetrisGame {
  constructor() {
    this.canvas = document.getElementById('tetris-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.wrapper = document.getElementById('canvas-wrapper');

    // 보조 캔버스들
    this.holdCanvas = document.getElementById('hold-canvas');
    this.holdCtx = this.holdCanvas.getContext('2d');
    this.nextCanvases = [
      document.getElementById('next-canvas-1'),
      document.getElementById('next-canvas-2'),
      document.getElementById('next-canvas-3')
    ];
    this.nextCtxs = this.nextCanvases.map(c => c.getContext('2d'));

    // UI 요소
    this.scoreEl = document.getElementById('score-display');
    this.highScoreEl = document.getElementById('highscore-display');
    this.linesEl = document.getElementById('lines-display');
    this.levelEl = document.getElementById('level-display');
    this.finalScoreEl = document.getElementById('final-score');
    this.newHighBadge = document.getElementById('new-high-badge');

    // 오버레이 요소
    this.startOverlay = document.getElementById('start-overlay');
    this.pauseOverlay = document.getElementById('pause-overlay');
    this.gameoverOverlay = document.getElementById('gameover-overlay');

    // 사운드 시스템
    this.audio = window.soundSystem;

    // 게임 상태
    this.board = this.createBoard();
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('neon_tetris_highscore')) || 0;
    this.lines = 0;
    this.level = 1;
    this.isPlaying = false;
    this.isPaused = false;
    this.isGameOver = false;

    // 블록 관련 상태
    this.bag = [];
    this.currentPiece = null;
    this.nextQueue = [];
    this.holdPiece = null;
    this.canHold = true;

    // 타이밍 & 루프
    this.dropCounter = 0;
    this.dropInterval = 1000;
    this.lastTime = 0;
    this.animationId = null;

    // 파티클 & 시각효과
    this.particles = [];
    this.floatingTexts = [];

    // 키 반복 (DAS / ARR)
    this.keyState = {};
    this.dasTimers = {};

    this.initUI();
    this.bindEvents();
    this.updateHighScoreDisplay();
  }

  createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  initUI() {
    this.updateScoreDisplay();
    this.drawEmptyGrid();
  }

  updateHighScoreDisplay() {
    this.highScoreEl.textContent = this.highScore.toLocaleString();
  }

  updateScoreDisplay() {
    this.scoreEl.textContent = this.score.toLocaleString();
    this.linesEl.textContent = this.lines;
    this.levelEl.textContent = this.level;
  }

  // 7-Bag 랜덤 생성 알고리즘
  fillBag() {
    const pieces = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    this.bag.push(...pieces);
  }

  getNextPieceType() {
    if (this.bag.length < 7) {
      this.fillBag();
    }
    return this.bag.shift();
  }

  initQueue() {
    this.bag = [];
    this.fillBag();
    this.nextQueue = [
      this.getNextPieceType(),
      this.getNextPieceType(),
      this.getNextPieceType(),
      this.getNextPieceType()
    ];
  }

  spawnPiece() {
    const type = this.nextQueue.shift();
    this.nextQueue.push(this.getNextPieceType());

    const def = TETROMINOES[type];
    const shape = def.shape.map(row => [...row]);
    const x = Math.floor((COLS - shape[0].length) / 2);
    const y = 0;

    this.currentPiece = {
      type,
      shape,
      color: def.color,
      glow: def.glow,
      x,
      y
    };

    this.canHold = true;

    // 충돌 체크 (스폰 시 바로 겹치면 게임 오버)
    if (this.checkCollision(this.currentPiece.x, this.currentPiece.y, this.currentPiece.shape)) {
      this.triggerGameOver();
    }

    this.drawSidePanels();
  }

  // 충돌 검사
  checkCollision(offsetX, offsetY, shape) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const newX = offsetX + c;
          const newY = offsetY + r;

          // 보드 경계 검사
          if (newX < 0 || newX >= COLS || newY >= ROWS) {
            return true;
          }
          // 기존 블록과 겹침 검사
          if (newY >= 0 && this.board[newY][newX]) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // 좌/우 이동
  move(dir) {
    if (!this.isPlaying || this.isPaused || !this.currentPiece) return;

    if (!this.checkCollision(this.currentPiece.x + dir, this.currentPiece.y, this.currentPiece.shape)) {
      this.currentPiece.x += dir;
      this.audio.playMove();
      this.draw();
    }
  }

  // 블록 시계방향 회전 + SRS Wall Kick 보정
  rotate() {
    if (!this.isPlaying || this.isPaused || !this.currentPiece) return;
    const shape = this.currentPiece.shape;
    const N = shape.length;
    // 90도 회전 행렬
    const rotated = shape.map((_, r) => shape.map(row => row[r]).reverse());

    // Wall Kick 시도 오프셋 (제자리, 좌, 우, 상, 좌2, 우2)
    const kickOffsets = [
      [0, 0],
      [-1, 0],
      [1, 0],
      [0, -1],
      [-2, 0],
      [2, 0]
    ];

    for (const [ox, oy] of kickOffsets) {
      if (!this.checkCollision(this.currentPiece.x + ox, this.currentPiece.y + oy, rotated)) {
        this.currentPiece.shape = rotated;
        this.currentPiece.x += ox;
        this.currentPiece.y += oy;
        this.audio.playRotate();
        this.draw();
        return;
      }
    }
  }

  // 소프트 드롭 (아래로 빠른 하강)
  softDrop() {
    if (!this.isPlaying || this.isPaused || !this.currentPiece) return;

    if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.shape)) {
      this.currentPiece.y++;
      this.score += 1;
      this.updateScoreDisplay();
      this.audio.playSoftDrop();
      this.dropCounter = 0;
      this.draw();
    } else {
      this.lockPiece();
    }
  }

  // 하드 드롭 (즉시 바닥으로)
  hardDrop() {
    if (!this.isPlaying || this.isPaused || !this.currentPiece) return;

    let dropDist = 0;
    while (!this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.shape)) {
      this.currentPiece.y++;
      dropDist++;
    }

    this.score += dropDist * 2;
    this.updateScoreDisplay();

    // 화면 쉐이크 연출 및 사운드
    this.shakeBoard();
    this.audio.playHardDrop();

    this.lockPiece();
  }

  // 블록 홀드 (Shift / C)
  hold() {
    if (!this.isPlaying || this.isPaused || !this.currentPiece || !this.canHold) return;

    const currentType = this.currentPiece.type;

    if (this.holdPiece === null) {
      this.holdPiece = currentType;
      this.spawnPiece();
    } else {
      const temp = this.holdPiece;
      this.holdPiece = currentType;
      const def = TETROMINOES[temp];
      this.currentPiece = {
        type: temp,
        shape: def.shape.map(row => [...row]),
        color: def.color,
        glow: def.glow,
        x: Math.floor((COLS - def.shape[0].length) / 2),
        y: 0
      };
    }

    this.canHold = false;
    this.audio.playHold();
    this.drawSidePanels();
    this.draw();
  }

  // 블록 고정
  lockPiece() {
    const { shape, color, x, y } = this.currentPiece;

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const boardY = y + r;
          const boardX = x + c;
          if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
            this.board[boardY][boardX] = color;
          }
        }
      }
    }

    this.clearLines();
    this.spawnPiece();
    this.draw();
  }

  // 라인 삭제 검사 및 처리
  clearLines() {
    let clearedCount = 0;
    const clearedIndices = [];

    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every(cell => cell !== 0)) {
        clearedCount++;
        clearedIndices.push(r);
      }
    }

    if (clearedCount > 0) {
      // 파티클 생성 및 이펙트
      clearedIndices.forEach(rowIndex => {
        this.createLineClearParticles(rowIndex);
      });

      // 점수 계산 (표준 테트리스 룰)
      const lineScores = [0, 100, 300, 500, 800];
      const baseScore = lineScores[clearedCount] || 800;
      const earned = baseScore * this.level;
      this.score += earned;
      this.lines += clearedCount;

      // 플로팅 텍스트
      const label = clearedCount === 4 ? `TETRIS! +${earned}` : `+${earned}`;
      this.addFloatingText(label, 150, clearedIndices[0] * BLOCK_SIZE);

      // 레벨 계산 (10줄마다 레벨업)
      const nextLevel = Math.floor(this.lines / 10) + 1;
      if (nextLevel > this.level) {
        this.level = nextLevel;
        this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 80);
        this.audio.playLevelUp();
        this.addFloatingText(`LEVEL UP!`, 150, 120);
      }

      this.updateScoreDisplay();

      // 라인 삭제 및 보드 갱신
      for (let i = 0; i < clearedCount; i++) {
        for (let r = ROWS - 1; r >= 0; r--) {
          if (this.board[r].every(cell => cell !== 0)) {
            this.board.splice(r, 1);
            this.board.unshift(Array(COLS).fill(0));
            break;
          }
        }
      }

      // 사운드 트리거
      this.audio.playLineClear(clearedCount);
    }
  }

  // 고스트 피스 (도달 위치 가이드) 계산
  getGhostY() {
    if (!this.currentPiece) return 0;
    let ghostY = this.currentPiece.y;
    while (!this.checkCollision(this.currentPiece.x, ghostY + 1, this.currentPiece.shape)) {
      ghostY++;
    }
    return ghostY;
  }

  // 시각 효과: 화면 진동
  shakeBoard() {
    this.wrapper.classList.remove('shake');
    void this.wrapper.offsetWidth; // 리플로우 강제
    this.wrapper.classList.add('shake');
  }

  // 시각 효과: 파티클 생성
  createLineClearParticles(rowIndex) {
    const y = rowIndex * BLOCK_SIZE + BLOCK_SIZE / 2;
    for (let c = 0; c < COLS; c++) {
      const x = c * BLOCK_SIZE + BLOCK_SIZE / 2;
      const color = this.board[rowIndex][c] || '#00f0ff';
      for (let p = 0; p < 8; p++) {
        this.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6 - 2,
          radius: Math.random() * 3 + 2,
          color,
          alpha: 1,
          decay: Math.random() * 0.03 + 0.02
        });
      }
    }
  }

  addFloatingText(text, x, y) {
    this.floatingTexts.push({
      text,
      x,
      y,
      alpha: 1,
      vy: -1.2
    });
  }

  // 렌더링 함수들
  drawEmptyGrid() {
    this.ctx.fillStyle = '#060710';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 격자선 렌더링
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    this.ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      this.ctx.beginPath();
      this.ctx.moveTo(c * BLOCK_SIZE, 0);
      this.ctx.lineTo(c * BLOCK_SIZE, ROWS * BLOCK_SIZE);
      this.ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, r * BLOCK_SIZE);
      this.ctx.lineTo(COLS * BLOCK_SIZE, r * BLOCK_SIZE);
      this.ctx.stroke();
    }
  }

  drawBlock(ctx, x, y, color, isGhost = false) {
    const size = BLOCK_SIZE;
    const px = x * size;
    const py = y * size;

    if (isGhost) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
      ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
      return;
    }

    // 모던 글로우 블록 렌더링
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillRect(px + 1.5, py + 1.5, size - 3, size - 3);

    // 하이라이트 베벨
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(px + 2, py + 2, size - 4, 3);
    ctx.fillRect(px + 2, py + 2, 3, size - 4);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(px + size - 5, py + 2, 3, size - 4);
    ctx.fillRect(px + 2, py + size - 5, size - 4, 3);
  }

  draw() {
    this.drawEmptyGrid();

    // 1. 고정된 보드 블록 그리기
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.board[r][c]) {
          this.drawBlock(this.ctx, c, r, this.board[r][c]);
        }
      }
    }

    if (this.currentPiece) {
      // 2. 고스트 피스 그리기
      const ghostY = this.getGhostY();
      const { shape, color, x, y } = this.currentPiece;

      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c]) {
            this.drawBlock(this.ctx, x + c, ghostY + r, color, true);
          }
        }
      }

      // 3. 현재 낙하 중인 블록 그리기
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c]) {
            this.drawBlock(this.ctx, x + c, y + r, color, false);
          }
        }
      }
    }

    // 4. 파티클 렌더링
    this.updateAndDrawParticles();

    // 5. 플로팅 텍스트 렌더링
    this.updateAndDrawFloatingTexts();
  }

  updateAndDrawParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 6;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  updateAndDrawFloatingTexts() {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const item = this.floatingTexts[i];
      item.y += item.vy;
      item.alpha -= 0.02;

      if (item.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = item.alpha;
      this.ctx.font = 'bold 16px Orbitron';
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = 10;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(item.text, item.x, item.y);
      this.ctx.restore();
    }
  }

  // 사이드 패널(HOLD, NEXT) 렌더링
  drawSidePanels() {
    // 1. HOLD 패널 그리기
    this.holdCtx.clearRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
    if (this.holdPiece) {
      this.drawMiniPiece(this.holdCtx, this.holdPiece, this.holdCanvas.width, this.holdCanvas.height, !this.canHold);
    }

    // 2. NEXT 큐 그리기 (상위 3개)
    for (let i = 0; i < 3; i++) {
      const ctx = this.nextCtxs[i];
      const canvas = this.nextCanvases[i];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (this.nextQueue[i]) {
        this.drawMiniPiece(ctx, this.nextQueue[i], canvas.width, canvas.height, false);
      }
    }
  }

  drawMiniPiece(ctx, type, width, height, isLocked) {
    const def = TETROMINOES[type];
    const shape = def.shape;
    const size = 18;
    const shapeWidth = shape[0].length * size;
    const shapeHeight = shape.length * size;
    const offsetX = (width - shapeWidth) / 2;
    const offsetY = (height - shapeHeight) / 2;

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const px = offsetX + c * size;
          const py = offsetY + r * size;

          ctx.fillStyle = isLocked ? '#64748b' : def.color;
          ctx.shadowColor = isLocked ? 'transparent' : def.color;
          ctx.shadowBlur = isLocked ? 0 : 5;
          ctx.fillRect(px + 1, py + 1, size - 2, size - 2);

          // 하이라이트
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.fillRect(px + 2, py + 2, size - 4, 2);
        }
      }
    }
  }

  // 메인 게임 루프
  update(time = 0) {
    if (!this.isPlaying || this.isPaused) return;

    const deltaTime = time - this.lastTime;
    this.lastTime = time;
    this.dropCounter += deltaTime;

    if (this.dropCounter > this.dropInterval) {
      if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.shape)) {
        this.currentPiece.y++;
      } else {
        this.lockPiece();
      }
      this.dropCounter = 0;
    }

    this.draw();
    this.animationId = requestAnimationFrame(this.update.bind(this));
  }

  // 게임 시작
  startGame() {
    this.board = this.createBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.dropInterval = 1000;
    this.dropCounter = 0;
    this.holdPiece = null;
    this.canHold = true;
    this.isPlaying = true;
    this.isPaused = false;
    this.isGameOver = false;

    this.updateScoreDisplay();
    this.initQueue();
    this.spawnPiece();

    this.startOverlay.classList.remove('active');
    this.pauseOverlay.classList.remove('active');
    this.gameoverOverlay.classList.remove('active');

    this.audio.init();
    if (this.audio.bgmEnabled) {
      this.audio.startBGM();
    }

    this.lastTime = performance.now();
    cancelAnimationFrame(this.animationId);
    this.animationId = requestAnimationFrame(this.update.bind(this));
  }

  // 일시정지 토글
  togglePause() {
    if (!this.isPlaying || this.isGameOver) return;

    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.pauseOverlay.classList.add('active');
      this.audio.stopBGM();
    } else {
      this.pauseOverlay.classList.remove('active');
      if (this.audio.bgmEnabled) {
        this.audio.startBGM();
      }
      this.lastTime = performance.now();
      this.animationId = requestAnimationFrame(this.update.bind(this));
    }
  }

  // 게임 오버
  triggerGameOver() {
    this.isPlaying = false;
    this.isGameOver = true;
    cancelAnimationFrame(this.animationId);

    // 하이스코어 체크 및 로컬스토리지 갱신
    let isNewHigh = false;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('neon_tetris_highscore', this.highScore);
      this.updateHighScoreDisplay();
      isNewHigh = true;
    }

    this.finalScoreEl.textContent = this.score.toLocaleString();
    if (isNewHigh && this.score > 0) {
      this.newHighBadge.classList.remove('hidden');
    } else {
      this.newHighBadge.classList.add('hidden');
    }

    this.gameoverOverlay.classList.add('active');
    this.audio.playGameOver();
  }

  // 키보드 & 터치 이벤트 바인딩
  bindEvents() {
    // 키보드 이벤트
    window.addEventListener('keydown', e => {
      // 폼 요소 등 포커스 없을 때 기본 스크롤 동작 방지
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      if (e.repeat) {
        // 길게 누를 때 처리 (소프트 드롭 & 좌우 이동)
        if (e.code === 'ArrowDown' || e.key === 's') this.softDrop();
        if (e.code === 'ArrowLeft' || e.key === 'a') this.move(-1);
        if (e.code === 'ArrowRight' || e.key === 'd') this.move(1);
        return;
      }

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.move(-1);
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.move(1);
          break;
        case 'ArrowUp':
        case 'KeyW':
          this.rotate();
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.softDrop();
          break;
        case 'Space':
          this.hardDrop();
          break;
        case 'KeyC':
        case 'ShiftLeft':
        case 'ShiftRight':
          this.hold();
          break;
        case 'KeyP':
        case 'Escape':
          this.togglePause();
          break;
        case 'KeyR':
          this.startGame();
          break;
      }
    });

    // 헤더 컨트롤 버튼
    const btnSoundFx = document.getElementById('btn-sound-fx');
    const btnSoundBgm = document.getElementById('btn-sound-bgm');
    const btnPauseHeader = document.getElementById('btn-pause-header');

    btnSoundFx.addEventListener('click', () => {
      const enabled = this.audio.toggleSFX();
      btnSoundFx.classList.toggle('muted', !enabled);
      btnSoundFx.querySelector('.icon').textContent = enabled ? '🔊' : '🔇';
    });

    btnSoundBgm.addEventListener('click', () => {
      const enabled = this.audio.toggleBGM();
      btnSoundBgm.classList.toggle('muted', !enabled);
      btnSoundBgm.querySelector('.icon').textContent = enabled ? '🎵' : '🔇';
    });

    btnPauseHeader.addEventListener('click', () => {
      this.togglePause();
    });

    // 오버레이 버튼들
    document.getElementById('btn-start').addEventListener('click', () => this.startGame());
    document.getElementById('btn-resume').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-restart-pause').addEventListener('click', () => this.startGame());
    document.getElementById('btn-restart').addEventListener('click', () => this.startGame());

    // 터치/마우스 온스크린 컨트롤러
    const bindTouchAction = (id, action) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      let intervalId = null;
      const startAction = (e) => {
        e.preventDefault();
        action();
        intervalId = setInterval(action, 120);
      };
      const stopAction = () => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      };

      btn.addEventListener('touchstart', startAction, { passive: false });
      btn.addEventListener('touchend', stopAction);
      btn.addEventListener('touchcancel', stopAction);
      btn.addEventListener('mousedown', startAction);
      btn.addEventListener('mouseup', stopAction);
      btn.addEventListener('mouseleave', stopAction);
    };

    const bindTouchClick = (id, action) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        action();
      });
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        action();
      }, { passive: false });
    };

    bindTouchAction('touch-left', () => this.move(-1));
    bindTouchAction('touch-right', () => this.move(1));
    bindTouchAction('touch-down', () => this.softDrop());
    bindTouchClick('touch-rotate', () => this.rotate());
    bindTouchClick('touch-drop', () => this.hardDrop());
    bindTouchClick('touch-hold', () => this.hold());
  }
}

// 브라우저 로드 시 게임 초기화
window.addEventListener('DOMContentLoaded', () => {
  window.tetrisGame = new TetrisGame();
});
