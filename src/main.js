/* Version: V4.1 — 3 Spiders + Battleheart Drag + Sylvan Background */
import './style.css';

import { Vec2 } from './engine/Vec2.js';
import { DistanceConstraint } from './engine/constraints.js';
import { Composite } from './engine/Composite.js';
import { VerletJS } from './engine/VerletJS.js';

import {
  initSylvanBackground,
  updateSylvanBackground,
  renderSylvanBackground,
  switchSylvanTheme,
  bgConfig,
  applyBgBlur,
  setBgParticleCount,
  THEMES as BG_THEMES
} from './render/sylvanBackground.js';

import { createSpiderweb } from './entities/spiderweb.js';
import { createSpider } from './entities/spider.js';
import { ThrownObj, clearObjectConstraints } from './entities/ThrownObj.js';

import {
  getWebSamplePoints, updateSamplePoints,
  findStepTarget, liftFoot, landFoot, triggerStep
} from './systems/footSystem.js';

import {
  getWebOuterR, inWebZone, radialRatioAt,
  collectPathHitCandidates, chooseStickCandidate
} from './systems/stickSystem.js';

import {
  buildWebGridList, cellCovered, scanWebCells
} from './systems/webIntegrity.js';

import {
  LEVEL_CONFIGS, GAME_DURATION, FOOD_VALUES,
  getLevelCfg, framesToTime
} from './systems/levelSystem.js';

import { audioEngine } from './audio/audioEngine.js';

import { setupWebDraw } from './render/webRenderer.js';
import { setupSpiderDraw } from './render/spiderRenderer.js';
import { drawThrownObjects } from './render/objectRenderer.js';
import { renderArtToCanvas } from './render/inventoryArt.js';

import { initOverlay, showOverlay, hideOverlay, playCollectFX } from './ui/overlay.js';
import { initPanel } from './ui/panel.js';

var requestAnimFrame = window.requestAnimationFrame
  || window.webkitRequestAnimationFrame
  || window.mozRequestAnimationFrame
  || function (cb) { window.setTimeout(cb, 1000 / 60); };

/* ================================================================
   MAIN
================================================================ */
window.onload = function () {

  var NUM_SPIDERS = 3;
  var WEB_SCALE = 1.2; /* 网放大 20% 以适配背景 */

  /* ── params ── */
  var DEFAULTS = {
    webRadius: 1.45, webSegs: 30, webDepth: 11, webStiff: 0.6,
    moveSpeed: 1.8, stepSpeed: 0.18, stepThresh: 22, restThresh: 50,
    legStiff: 0.3, jointStiff: 0.35,
    stickDelayMin: 0.10, stickDelayMax: 0.45, stickCatchRadius: 18,
    stickMidBias: 0.8, stickHistory: 40,
    flyWeight: 3, leafWeight: 1,
    flyReleaseSec: 5, leafReleaseSec: 0,
    /* 背景与音乐 */
    bgTheme: 0, bgBlur: 100, bgWind: 1.0, bgRay: 55, bgPart: 40, bgVol: 60,
    bgMusicOn: 1, bgLayoutVersion: 1
  };
  var P = Object.assign({}, DEFAULTS);
  try {
    var saved = JSON.parse(localStorage.getItem('spiderPanelParams') || '{}');
    /* 旧版本没有 bg 参数，重置避免异常 */
    if (!saved.bgLayoutVersion) {
      ['bgTheme','bgBlur','bgWind','bgRay','bgPart','bgVol','bgMusicOn','bgLayoutVersion'].forEach(function(k){ delete saved[k]; });
    }
    Object.assign(P, saved);
  } catch (e) { }

  /* ── canvas ── */
  var screenShellEl = document.querySelector('.screen-shell');
  var canvas = document.getElementById('scratch');
  var collectLayer = document.getElementById('collect-layer');
  var W = parseInt(canvas.style.width), H = parseInt(canvas.style.height);
  var dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.getContext('2d').scale(dpr, dpr);
  var cx = W / 2, cy = H / 2;

  var sim = new VerletJS(W, H, canvas);
  sim.gravity = new Vec2(0, 0);
  initSylvanBackground(W, H, screenShellEl);

  /* ── 拖拽视差状态 ── */
  var _dragOffset = { x: 0, y: 0 };
  var _smoothDrag = { x: 0, y: 0 };

  /* ── 音频解锁（首次交互时恢复 AudioContext） ── */
  function _unlockAudio() {
    try { var ac = audioEngine.getAC && audioEngine.getAC(); if (ac && ac.state === 'suspended') ac.resume(); } catch(e){}
    ['click','touchstart','keydown'].forEach(function(ev){ document.removeEventListener(ev, _unlockAudio); });
  }
  ['click','touchstart','keydown'].forEach(function(ev){ document.addEventListener(ev, _unlockAudio, { once: true }); });

  /* Disable VerletJS built-in drag (we handle input ourselves) */
  sim.canvas.onmousedown = null;
  sim.canvas.onmouseup = null;
  sim.canvas.onmousemove = null;

  /* ── shared runtime ── */
  var spiderweb, samplePoints = [];
  var STEP_SPEED, STEP_THRESH, REST_THRESH, STEP_COOLDOWN = 6;
  var moveSpeed = P.moveSpeed, arriveThreshold = 6;

  /* ================================================================
     SPIDER UNITS — each spider has its own state
  ================================================================ */
  var spiderUnits = []; /* [{spider, footState, target, moveDir, wrappingTarget, blinkState, legConstraintCount}] */

  function makeBlinkState() {
    return { scale: 1, blinking: false, t: 0, nextBlink: 120 + Math.floor(Math.random() * 300) };
  }

  function updateBlink(bs) {
    if (bs.blinking) {
      bs.t += 0.18;
      if (bs.t <= 1) bs.scale = 1 - 0.95 * (bs.t < 0.5 ? 2 * bs.t * bs.t : -1 + (4 - 2 * bs.t) * bs.t);
      else if (bs.t <= 2) { var t2 = bs.t - 1; bs.scale = 0.05 + 0.95 * (t2 < 0.5 ? 2 * t2 * t2 : -1 + (4 - 2 * t2) * t2); }
      else { bs.scale = 1; bs.blinking = false; bs.t = 0; bs.nextBlink = 180 + Math.floor(Math.random() * 300); }
    } else { bs.nextBlink--; if (bs.nextBlink <= 0) { bs.blinking = true; bs.t = 0; } }
  }

  /* ── web override ── */
  var webOverride = null;
  var webCx = 0, webCy = 0, webRad = 1;

  function buildWeb() {
    if (spiderweb) {
      var idx = sim.composites.indexOf(spiderweb);
      if (idx !== -1) sim.composites.splice(idx, 1);
    }
    var ov = webOverride || {};
    var segs = ov.segs || P.webSegs;
    var depth = ov.depth || P.webDepth;
    var rad = ov.radius || Math.round(Math.min(W, H) / 2 * P.webRadius * WEB_SCALE);
    var ocx = (ov.cx != null) ? ov.cx : cx;
    var ocy = (ov.cy != null) ? ov.cy : cy;
    var pStep = ov.pinStep || 4;
    spiderweb = createSpiderweb(sim, new Vec2(ocx, ocy), rad, segs, depth, P.webStiff, pStep);
    webCx = ocx; webCy = ocy; webRad = rad;
    var wi = sim.composites.indexOf(spiderweb);
    if (wi !== 0) { sim.composites.splice(wi, 1); sim.composites.unshift(spiderweb); }
    samplePoints = getWebSamplePoints(spiderweb, 4);
    setupWebDraw(spiderweb, function () { return thrownObjects; }, function () { return webBreakFlashes; }, function () { return _breakFrame; });
  }

  /* ── Build spiders ── */
  var ALL_ROLES = ['default', 'collector', 'healer'];

  /**
   * Create a single spider unit at a specific position with a role
   * @returns the created unit
   */
  function addSpiderUnit(role, sx, sy) {
    var spider = createSpider(sim, new Vec2(sx, sy), { legStiff: P.legStiff, jointStiff: P.jointStiff });
    spider.thorax.pos.mutableSet(new Vec2(sx, sy)); spider.thorax.lastPos.mutableSet(new Vec2(sx, sy));
    spider.head.pos.mutableSet(new Vec2(sx, sy - 6)); spider.head.lastPos.mutableSet(new Vec2(sx, sy - 6));
    spider.abdomen.pos.mutableSet(new Vec2(sx, sy + 12)); spider.abdomen.lastPos.mutableSet(new Vec2(sx, sy + 12));

    var legConstraintCount = spider.constraints.length;
    var footState = spider.legs.map(function (lp, idx) {
      var fa = (idx / 4) * Math.PI * 2 - Math.PI / 4;
      var ip = new Vec2(sx + Math.cos(fa) * 25, sy + Math.sin(fa) * 25);
      lp.pos.mutableSet(ip); lp.lastPos.mutableSet(ip);
      return {
        particle: lp, current: new Vec2(ip.x, ip.y), from: new Vec2(ip.x, ip.y),
        targetPos: new Vec2(ip.x, ip.y), targetStepPoint: null,
        landedNode: null, landedSeg: null, constraintA: null, constraintB: null,
        stepping: false, t: 1, cooldown: idx * 6
      };
    });

    var blinkState = makeBlinkState();
    var unit = {
      spider: spider, footState: footState, legConstraintCount: legConstraintCount,
      blinkState: blinkState, role: role,
      target: null, moveDir: null, wrappingTarget: null
    };

    setupSpiderDraw(spider, legConstraintCount, footState, blinkState, (function (u) {
      return function () { return u.wrappingTarget; };
    })(unit), role);

    spiderUnits.push(unit);

    /* Initial foot placement */
    var delay = spiderUnits.length * 80;
    (function (u) {
      setTimeout(function () {
        triggerStep(0, null, u.footState, spiderweb, u.spider, samplePoints, null, STEP_COOLDOWN);
        triggerStep(2, null, u.footState, spiderweb, u.spider, samplePoints, null, STEP_COOLDOWN);
      }, 60 + delay);
      setTimeout(function () {
        triggerStep(1, null, u.footState, spiderweb, u.spider, samplePoints, null, STEP_COOLDOWN);
        triggerStep(3, null, u.footState, spiderweb, u.spider, samplePoints, null, STEP_COOLDOWN);
      }, 210 + delay);
    })(unit);

    return unit;
  }

  /**
   * Build spiders — optionally only specified roles
   * @param {Array} [roles] - which roles to create, default all 3
   */
  function buildSpiders(roles) {
    /* Remove old spider composites */
    for (var si = 0; si < spiderUnits.length; si++) {
      var old = spiderUnits[si].spider;
      if (old) { var idx = sim.composites.indexOf(old); if (idx !== -1) sim.composites.splice(idx, 1); }
    }
    spiderUnits = [];
    STEP_SPEED = P.stepSpeed; STEP_THRESH = P.stepThresh; REST_THRESH = P.restThresh;

    var rolesToBuild = roles || ALL_ROLES;
    var angleStep = (Math.PI * 2) / rolesToBuild.length;
    var spawnRadius = rolesToBuild.length === 1 ? 0 : 40;

    for (var i = 0; i < rolesToBuild.length; i++) {
      var angle = angleStep * i - Math.PI / 2;
      var sx = cx + Math.cos(angle) * spawnRadius;
      var sy = cy + Math.sin(angle) * spawnRadius;
      addSpiderUnit(rolesToBuild[i], sx, sy);
    }
  }

  /* initial build */
  buildWeb(); buildSpiders();
  initOverlay();

  /* ================================================================
     TUTORIAL SYSTEM
  ================================================================ */
  var tutorialStep = -1; /* -1 = not in tutorial */
  var tutorialHintEl = document.getElementById('tutorial-hint');
  var _tutorialBugReleased = false;  /* track if a bug has released (broken web) */
  var _tutorialRepairDone = false;   /* track if healer completed a repair */

  function showHint(text) {
    if (!tutorialHintEl) return;
    tutorialHintEl.textContent = text;
    tutorialHintEl.classList.add('visible');
  }

  function hideHint() {
    if (!tutorialHintEl) return;
    tutorialHintEl.classList.remove('visible');
  }

  /**
   * Advance the tutorial state machine.
   * Called from various game events (collect, bug escape, kill, repair).
   */
  function advanceTutorial(event) {
    if (tutorialStep < 0) return;

    if (tutorialStep === 0) {
      /* Waiting: show hint, leaves are already spawned */
      /* → advance when player collects first leaf */
      if (event === 'collect_drop') {
        tutorialStep = 1;
        hideHint();
        /* Spawn a fly + 1 leaf after 1.5s */
        setTimeout(function () {
          launchObject('bug');
          launchObject('drop');
          showHint('苍蝇会破坏蜘蛛网！');
          tutorialStep = 2;
        }, 1500);
      }
    } else if (tutorialStep === 2) {
      /* Waiting for bug to escape and break web */
      if (event === 'bug_released') {
        tutorialStep = 3;
        hideHint();
        /* Spawn black spider after 1s */
        setTimeout(function () {
          var angle = -Math.PI / 2;
          addSpiderUnit('default', cx + Math.cos(angle) * 50, cy + Math.sin(angle) * 50);
          showHint('拖拽黑色蜘蛛到苍蝇上消灭它');
          tutorialStep = 4;
        }, 1000);
      }
    } else if (tutorialStep === 4) {
      /* Waiting for player to kill the bug */
      if (event === 'kill_bug') {
        tutorialStep = 5;
        hideHint();
        /* Spawn white spider + 1 leaf after 1s */
        setTimeout(function () {
          var angle = Math.PI / 6;
          addSpiderUnit('healer', cx + Math.cos(angle) * 50, cy + Math.sin(angle) * 50);
          launchObject('drop');
          showHint('拖拽白色蜘蛛到破损处修复蜘蛛网');
          tutorialStep = 6;
        }, 1000);
      }
    } else if (tutorialStep === 6) {
      /* Waiting for healer to complete a repair */
      if (event === 'repair_done') {
        tutorialStep = 7;
        hideHint();
        setTimeout(function () {
          showHint('很好！准备迎接更多挑战');
          /* Spawn 1 more fly + 1 leaf */
          launchObject('bug');
          setTimeout(function () { launchObject('drop'); }, 300);
          tutorialStep = 8;
          /* Hide hint after 3s */
          setTimeout(function () { hideHint(); }, 3000);
        }, 800);
      }
    }
    /* step 8: normal play until foodGoal reached */
  }

  /**
   * Start tutorial for level 0
   */
  function startTutorial() {
    tutorialStep = 0;
    _tutorialBugReleased = false;
    _tutorialRepairDone = false;
    /* Only green spider at start */
    buildSpiders(['collector']);
    /* Spawn 2 leaves after 2s */
    setTimeout(function () {
      launchObject('drop');
      setTimeout(function () { launchObject('drop'); }, 500);
      showHint('拖拽绿色蜘蛛到树叶上采集食物');
    }, 1200);
  }

  /* ================================================================
     DRAG INPUT SYSTEM (Battleheart style)
  ================================================================ */
  var dragState = {
    active: false,
    unitIndex: -1,   /* which spider is being dragged */
    startX: 0, startY: 0,
    currentX: 0, currentY: 0
  };

  /** Convert mouse/touch event to canvas coordinates */
  function eventToCanvas(e) {
    var r = canvas.getBoundingClientRect();
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return new Vec2(
      (clientX - r.left) * (W / r.width),
      (clientY - r.top) * (H / r.height)
    );
  }

  /** Find which spider is near a point (returns unit index or -1) */
  function findSpiderAt(pos) {
    var bestDist = 35 * 35; /* selection radius squared */
    var bestIdx = -1;
    for (var i = 0; i < spiderUnits.length; i++) {
      var u = spiderUnits[i];
      /* Check thorax and abdomen */
      var dt = u.spider.thorax.pos.dist2(pos);
      var da = u.spider.abdomen.pos.dist2(pos);
      var d = Math.min(dt, da);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    return bestIdx;
  }

  /** Find if drag endpoint is over a stuck prey that this role can collect */
  function findPreyAt(pos, role) {
    for (var oi = 0; oi < thrownObjects.length; oi++) {
      var obj = thrownObjects[oi];
      if (obj.state !== 'stuck') continue;
      var d = obj.particle.pos.dist2(pos);
      if (d < 25 * 25) {
        /* Return the prey even if role can't collect — caller decides feedback */
        return obj;
      }
    }
    return null;
  }

  function onDragStart(e) {
    e.preventDefault();
    var pos = eventToCanvas(e);
    var idx = findSpiderAt(pos);
    if (idx === -1) return; /* didn't touch any spider */
    /* Don't start drag if this spider is currently wrapping */
    if (spiderUnits[idx].wrappingTarget !== null) return;
    dragState.active = true;
    dragState.unitIndex = idx;
    dragState.startX = pos.x; dragState.startY = pos.y;
    dragState.currentX = pos.x; dragState.currentY = pos.y;
  }

  function onDragMove(e) {
    e.preventDefault();
    if (!dragState.active) return;
    var pos = eventToCanvas(e);
    dragState.currentX = pos.x;
    dragState.currentY = pos.y;
  }

  function onDragEnd(e) {
    e.preventDefault();
    if (!dragState.active) return;
    var pos;
    if (e.changedTouches) {
      var r = canvas.getBoundingClientRect();
      pos = new Vec2(
        (e.changedTouches[0].clientX - r.left) * (W / r.width),
        (e.changedTouches[0].clientY - r.top) * (H / r.height)
      );
    } else {
      pos = eventToCanvas(e);
    }

    var u = spiderUnits[dragState.unitIndex];
    if (u) {
      /* Check if endpoint is over a stuck prey → move + auto-wrap */
      var prey = findPreyAt(pos, u.role);
      if (prey && canCollect(u.role, prey.kind)) {
        /* Role matches: set target to prey position */
        u.target = new Vec2(prey.particle.pos.x, prey.particle.pos.y);
        u._targetPrey = prey;
      } else {
        /* Move to empty point (or prey this spider can't collect → just move) */
        u.target = pos;
        u._targetPrey = null;
      }
    }

    dragState.active = false;
    dragState.unitIndex = -1;
  }

  canvas.addEventListener('mousedown', onDragStart);
  canvas.addEventListener('mousemove', onDragMove);
  canvas.addEventListener('mouseup', onDragEnd);
  canvas.addEventListener('touchstart', onDragStart, { passive: false });
  canvas.addEventListener('touchmove', onDragMove, { passive: false });
  canvas.addEventListener('touchend', onDragEnd, { passive: false });
  canvas.oncontextmenu = function (e) { e.preventDefault(); };

  /** Draw drag line (Battleheart style) — called during render phase */
  function drawDragLine(ctx) {
    if (!dragState.active || dragState.unitIndex < 0) return;
    var u = spiderUnits[dragState.unitIndex];
    if (!u) return;

    var fromX = u.spider.thorax.pos.x;
    var fromY = u.spider.thorax.pos.y;
    var toX = dragState.currentX;
    var toY = dragState.currentY;

    /* Check if endpoint is over prey */
    var overPrey = findPreyAt(new Vec2(toX, toY), u.role);
    var canDo = overPrey ? canCollect(u.role, overPrey.kind) : false;

    /* Role-based selection ring color */
    var ringColor = u.role === 'collector' ? 'rgba(100,220,100,0.6)'
                  : u.role === 'fighter'   ? 'rgba(220,100,100,0.6)'
                  : u.role === 'healer'    ? 'rgba(220,220,220,0.6)'
                  : 'rgba(255,255,255,0.5)';

    /* Selection ring around dragged spider */
    ctx.beginPath();
    ctx.arc(fromX, fromY, 18, 0, 2 * Math.PI);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    /* Dashed line from spider to cursor */
    ctx.beginPath();
    ctx.setLineDash([6, 4]);
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    if (overPrey && canDo) ctx.strokeStyle = 'rgba(255,100,80,0.8)';       /* red = valid target */
    else if (overPrey && !canDo) ctx.strokeStyle = 'rgba(120,120,120,0.5)'; /* gray = can't collect */
    else ctx.strokeStyle = 'rgba(255,255,255,0.6)';                         /* white = move */
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    /* Target indicator */
    if (overPrey && canDo) {
      /* Pulsing target ring on prey */
      var pulse = 0.6 + 0.4 * Math.sin(Date.now() * 0.008);
      ctx.beginPath();
      ctx.arc(toX, toY, 16 * pulse + 8, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255,100,80,' + (0.4 + pulse * 0.4) + ')';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else if (overPrey && !canDo) {
      /* Forbidden indicator: X mark */
      ctx.beginPath();
      ctx.moveTo(toX - 8, toY - 8); ctx.lineTo(toX + 8, toY + 8);
      ctx.moveTo(toX + 8, toY - 8); ctx.lineTo(toX - 8, toY + 8);
      ctx.strokeStyle = 'rgba(200,80,80,0.7)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(toX, toY, 14, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(200,80,80,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      /* Small crosshair */
      ctx.beginPath();
      ctx.arc(toX, toY, 5, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(toX - 8, toY); ctx.lineTo(toX + 8, toY);
      ctx.moveTo(toX, toY - 8); ctx.lineTo(toX, toY + 8);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /* ================================================================
     THROWN OBJECTS & GAME STATE
  ================================================================ */
  var thrownObjects = [];
  var objCounts = { bug: 0, drop: 0 };
  var foodCollected = 0;  /* current level food progress */

  var gameState = 'IDLE';
  var currentLevel = 0;
  var totalScore = 0;
  var levelScored = false;
  var pendingLevelCheck = false;
  var levelTimer = 0;
  var gameFrames = 0;
  var difficultyLevel = 1;
  var webGridStep = 35;
  var webGridCoverD = 22;
  var webInitCells = 1;
  var webGridList = null;
  var webWarmupFrames = 0;
  var webScanPending = 0;
  var webLossPct = 0;
  var webBreakFlashes = [];
  var _breakFrame = 0;

  var spawnIndex = 0; /* index into current level's spawns array */
  /* foodCollected is reset per level in startLevel() */
  var webGridBuildIdx = 0;
  var webGridInitCover = 0;

  function getCfg(n) { return getLevelCfg(n, difficultyLevel); }

  /* ── IDLE start screen ── */
  showOverlay(
    '<div class="overlay-title">SPIDER WEB</div>'
    + '<div class="overlay-subtitle" style="margin-bottom:6px">操控 3 只蜘蛛收集网上的猎物</div>'
    + '<div class="overlay-subtitle" style="margin-bottom:6px;opacity:0.7">拖拽蜘蛛到目标位置或猎物</div>'
    + '<div class="overlay-subtitle" style="margin-bottom:22px;opacity:0.6">在 3 分钟内坚持到底，网破就输</div>'
    + '<button class="overlay-btn" id="btn-start-game">开始游戏</button>'
  );
  document.getElementById('btn-start-game').onclick = startGameFromBeginning;

  /* ── Game flow ── */
  function startGame() {
    spiderUnits.forEach(function (u) { u.wrappingTarget = null; u.target = null; });
    /* BGM now managed by sylvan background system */
    totalScore = 0; currentLevel = 0; gameFrames = 0; levelScored = false;
    document.getElementById('score-txt').textContent = '0';
    document.getElementById('score-bar').style.display = 'block';
    document.getElementById('wave-bar').style.display = 'block';
    webOverride = {
      segs: 20 + Math.floor(Math.random() * 18),
      depth: 8 + Math.floor(Math.random() * 7),
      radius: Math.round(Math.min(W, H) / 2 * (1.25 + Math.random() * 0.35) * WEB_SCALE),
      cx: cx + (Math.random() - 0.5) * 40,
      cy: cy + (Math.random() - 0.5) * 40,
      pinStep: 3 + Math.floor(Math.random() * 4)
    };
    buildWeb(); buildSpiders();
    /* BGM 由背景系统管理 */
    if (P.bgMusicOn) audioEngine.playLevelBGM(P.bgTheme);
    startLevel(0);
  }

  function startGameFromBeginning() { difficultyLevel = 1; startGame(); }

  function startLevel(n) {
    spiderUnits.forEach(function (u) { u.wrappingTarget = null; u.target = null; });
    currentLevel = n; levelTimer = 0; levelScored = false; pendingLevelCheck = false;
    foodCollected = 0;
    clearAllObjects();
    var cfg = getCfg(n);
    spawnIndex = 0;
    tutorialStep = -1; /* reset tutorial */
    hideHint();
    refreshFoodBar();
    /* 切换背景主题 */
    if (typeof switchSylvanTheme === 'function') switchSylvanTheme(n % BG_THEMES.length);
    gameState = 'LEVEL_ACTIVE'; hideOverlay();
    document.getElementById('wave-bar').style.display = 'block';
    levelTimer = 0;
    webWarmupFrames = 90;
    webGridList = null; webInitCells = 1; webScanPending = 0; webLossPct = 0;
    webGridBuildIdx = 0; webGridInitCover = 0;

    /* Tutorial level: event-driven, only green spider at start */
    if (cfg.tutorial) {
      startTutorial();
    }
  }

  function endLevel() {
    if (gameState !== 'LEVEL_ACTIVE' && gameState !== 'LEVEL_RESULT') return;
    if (levelScored) return;
    levelScored = true;
    var ws = foodCollected;
    totalScore += ws;
    document.getElementById('score-txt').textContent = totalScore;
    if (currentLevel >= LEVEL_CONFIGS.length - 1) showSuccess();
    else showLevelResult(ws);
  }

  function showLevelResult(levelScore) {
    if (gameState === 'GAME_OVER' || gameState === 'SUCCESS') return;
    gameState = 'LEVEL_RESULT'; audioEngine.playSfxSuccess(); clearAllObjects();
    document.getElementById('wave-bar').style.display = 'none';
    showOverlay(
      '<div class="overlay-title">第 ' + (currentLevel + 1) + ' 关完成！</div>'
      + '<div class="overlay-subtitle">得分 +' + (levelScore || 0) + '  &nbsp;·&nbsp;  总分 ' + totalScore + '</div>'
      + '<button class="overlay-btn" id="btn-nextwv" style="margin-top:16px">进入第 ' + (currentLevel + 2) + ' 关</button>'
      + '<br><button class="overlay-btn" style="background:#555;margin-top:8px" id="btn-restart-wr">从头开始</button>'
    );
    document.getElementById('btn-nextwv').onclick = resetWebAndStartNextLevel;
    document.getElementById('btn-restart-wr').onclick = startGameFromBeginning;
  }

  function resetWebAndStartNextLevel() {
    gameFrames = 0;
    webOverride = {
      segs: 20 + Math.floor(Math.random() * 18), depth: 8 + Math.floor(Math.random() * 7),
      radius: Math.round(Math.min(W, H) / 2 * (1.25 + Math.random() * 0.35) * WEB_SCALE),
      cx: cx + (Math.random() - 0.5) * 40, cy: cy + (Math.random() - 0.5) * 40,
      pinStep: 3 + Math.floor(Math.random() * 4)
    };
    buildWeb(); buildSpiders();
    startLevel(currentLevel + 1);
  }

  function showSuccess() {
    if (gameState === 'SUCCESS' || gameState === 'GAME_OVER') return;
    gameState = 'SUCCESS'; audioEngine.playSfxSuccess(); clearAllObjects();
    document.getElementById('wave-bar').style.display = 'none';
    showOverlay(
      '<div class="overlay-title">通关！</div>'
      + '<div class="overlay-subtitle">难度 ' + difficultyLevel + '  ·  总得分 ' + totalScore + '</div>'
      + '<div class="overlay-total-score">' + totalScore + ' 分</div>'
      + '<button class="overlay-btn" id="btn-nextlv" style="margin-bottom:8px">更高难度挑战</button>'
      + '<br><button class="overlay-btn" style="background:#555;margin-top:4px" id="btn-restart-s">从头开始</button>'
    );
    document.getElementById('btn-nextlv').onclick = function () { difficultyLevel++; startGame(); };
    document.getElementById('btn-restart-s').onclick = startGameFromBeginning;
  }

  function showGameOver() {
    if (gameState === 'GAME_OVER' || gameState === 'SUCCESS') return;
    gameState = 'GAME_OVER'; audioEngine.playSfxGameOver(); clearAllObjects();
    document.getElementById('wave-bar').style.display = 'none';
    showOverlay(
      '<div class="overlay-title">网破了！</div>'
      + '<div class="overlay-subtitle">难度 ' + difficultyLevel + '  第 ' + (currentLevel + 1) + ' 关  ·  坚持 ' + framesToTime(gameFrames) + '</div>'
      + '<div class="overlay-total-score">' + totalScore + ' 分</div>'
      + '<button class="overlay-btn" id="btn-retry" style="margin-bottom:8px">再试一次</button>'
      + '<br><button class="overlay-btn" style="background:#555;margin-top:4px" id="btn-restart-f">从头开始</button>'
    );
    document.getElementById('btn-retry').onclick = startGame;
    document.getElementById('btn-restart-f').onclick = startGameFromBeginning;
  }

  function checkLevelComplete() {
    var cfg = getCfg(currentLevel);
    if (foodCollected >= cfg.foodGoal) endLevel();
  }

  /* ── Web integrity (unchanged) ── */
  function _buildWebGrid() {
    webGridList = buildWebGridList(webCx, webCy, webRad, webGridStep);
    webGridBuildIdx = 0; webGridInitCover = 0; webInitCells = 1;
  }
  function continueWebGridBuild() {
    if (!webGridList || webGridBuildIdx >= webGridList.length) return;
    var end = Math.min(webGridBuildIdx + 50, webGridList.length);
    for (var k = webGridBuildIdx; k < end; k++) {
      if (cellCovered(webGridList[k].x, webGridList[k].y, spiderweb, webGridCoverD)) webGridInitCover++;
    }
    webGridBuildIdx = end;
    if (webGridBuildIdx >= webGridList.length) webInitCells = webGridInitCover || 1;
  }
  function _scanWebCells() {
    if (!webGridList || !webGridList.length) return;
    var covered = scanWebCells(webGridList, spiderweb, webGridCoverD);
    var loss = 1 - covered / webInitCells; if (loss < 0) loss = 0;
    var pct = Math.round(loss * 100); if (pct > webLossPct) webLossPct = pct;
  }
  function checkWebIntegrity() {
    if (gameState !== 'LEVEL_ACTIVE' || !spiderweb) return;
    if (webWarmupFrames > 0) {
      webWarmupFrames--;
      if (webWarmupFrames === 0) _buildWebGrid();
      var dbgEl = document.getElementById('dbg-web'); if (dbgEl) dbgEl.textContent = '网损: 0%';
      return;
    }
    if (webGridBuildIdx < (webGridList ? webGridList.length : 0)) continueWebGridBuild();
    if (webScanPending > 0) { webScanPending--; if (webScanPending === 0) _scanWebCells(); }
    var dbgEl = document.getElementById('dbg-web'); if (dbgEl) dbgEl.textContent = '网损: ' + webLossPct + '%';
    if (webLossPct >= 50) showGameOver();
  }

  /* ── Timer & spawner (unchanged) ── */
  function updateLevelTimer() {
    if (gameState === 'IDLE' || gameState === 'GAME_OVER' || gameState === 'SUCCESS') return;
    levelTimer++; gameFrames++;
    var remaining = Math.max(0, GAME_DURATION - gameFrames);
    var rs = Math.ceil(remaining / 60);
    var rm = Math.floor(rs / 60); var rsec = rs % 60;
    var cntStr = (rm > 0 ? rm + 'm ' : '') + rsec + 's';
    if (gameState === 'LEVEL_ACTIVE') {
      document.getElementById('wave-bar').textContent = '第' + (currentLevel + 1) + '关  难度' + difficultyLevel + '  ' + cntStr;
      if (gameFrames >= GAME_DURATION) endLevel();
    } else if (gameState === 'LEVEL_RESULT') {
      document.getElementById('wave-bar').textContent = cntStr;
      if (gameFrames >= GAME_DURATION) endLevel();
    }
  }
  function updateLevelSpawner() {
    if (gameState !== 'LEVEL_ACTIVE') return;
    var cfg = getCfg(currentLevel);
    var spawns = cfg.spawns;
    while (spawnIndex < spawns.length && levelTimer >= spawns[spawnIndex].time) {
      launchObject(spawns[spawnIndex].kind);
      spawnIndex++;
    }
  }

  /* ── Object management ── */
  function updateBadge(kind, delta) {
    objCounts[kind] = Math.max(0, objCounts[kind] + delta);
    document.getElementById('cnt-' + kind).textContent = objCounts[kind];
  }
  function launchObject(kind) {
    var obj = new ThrownObj(kind, W, H, sim, P, gameState, getCfg, currentLevel);
    obj._W = W; obj._H = H;
    thrownObjects.push(obj); updateBadge(kind, 1);
  }
  function clearAllObjects() {
    spiderUnits.forEach(function (u) { u.wrappingTarget = null; u._repairCooldown = 0; });
    repairingConstraints = [];
    audioEngine.stopAllBugBuzz();
    thrownObjects.forEach(function (o) {
      if (o.collectEl && o.collectEl.parentNode) o.collectEl.parentNode.removeChild(o.collectEl);
      o.collectCanvas = null; o.destroy(sim);
    });
    thrownObjects = [];
    ['bug', 'drop'].forEach(function (k) { objCounts[k] = 0; var el = document.getElementById('cnt-' + k); if (el) el.textContent = 0; });
  }
  /** Update food progress bar */
  function refreshFoodBar() {
    var cfg = getCfg(currentLevel);
    var goal = cfg.foodGoal;
    var pct = Math.min(100, Math.round(foodCollected / goal * 100));
    var fillEl = document.getElementById('food-bar-fill');
    var labelEl = document.getElementById('food-bar-label');
    if (fillEl) fillEl.style.width = pct + '%';
    if (labelEl) labelEl.textContent = foodCollected + ' / ' + goal;
  }

  /** Show +N pop text above progress bar */
  function showFoodPop(amount) {
    var popEl = document.getElementById('food-bar-pop');
    if (!popEl) return;
    popEl.textContent = '+' + amount;
    popEl.style.animation = 'none';
    void popEl.offsetWidth;
    popEl.style.animation = 'foodPopAnim 0.5s ease-out forwards';
  }

  function addFood(kind) {
    if (gameState !== 'LEVEL_ACTIVE') return;
    var amount = FOOD_VALUES[kind] || 1;
    foodCollected += amount;
    refreshFoodBar();
    showFoodPop(amount);
    pendingLevelCheck = true;
    if (kind === 'drop') advanceTutorial('collect_drop');
  }
  function getCanvasPointOnStage(x, y) {
    var stageRect = screenShellEl.getBoundingClientRect();
    var canvasRect = canvas.getBoundingClientRect();
    return { x: (canvasRect.left - stageRect.left) + x * (canvasRect.width / W), y: (canvasRect.top - stageRect.top) + y * (canvasRect.height / H) };
  }
  function getInventoryTarget(kind) {
    /* Fly toward the food progress bar */
    var slot = document.getElementById('food-bar-wrap');
    if (!slot) return { x: W / 2, y: 20 }; /* fallback */
    var slotRect = slot.getBoundingClientRect(); var stageRect = screenShellEl.getBoundingClientRect();
    return { x: slotRect.left + slotRect.width * 0.5 - stageRect.left, y: slotRect.top + slotRect.height * 0.5 - stageRect.top };
  }
  function circlesOverlap(ax, ay, ar, bx, by, br) {
    var dx = ax - bx, dy = ay - by, rr = ar + br; return dx * dx + dy * dy <= rr * rr;
  }
  function beginCollectObject(obj, unit) {
    var p = obj.particle;
    var startPos = getCanvasPointOnStage(p.pos.x, p.pos.y);
    var targetPos = getInventoryTarget(obj.kind);
    clearObjectConstraints(obj);
    obj.state = 'collecting'; obj.collectT = 0; obj.collectPause = 12; obj.collectFlash = 0; obj.travelT = 0;
    obj.collectDur = 40;
    obj.collectFromX = startPos.x; obj.collectFromY = startPos.y;
    obj.collectToX = targetPos.x; obj.collectToY = targetPos.y;
    p.lastPos.x = p.pos.x; p.lastPos.y = p.pos.y; obj.alpha = 0;
    obj.collectEl = document.createElement('div'); obj.collectEl.className = 'collect-token';
    obj.collectCanvas = document.createElement('canvas'); obj.collectCanvas.className = 'collect-token-art';
    obj.collectCanvas.width = 34; obj.collectCanvas.height = 34;
    renderArtToCanvas(obj.collectCanvas, obj.kind);
    obj.collectEl.appendChild(obj.collectCanvas);
    obj.collectEl.style.left = obj.collectFromX + 'px'; obj.collectEl.style.top = obj.collectFromY + 'px';
    collectLayer.appendChild(obj.collectEl);
  }
  function beginWrapping(obj, unit) {
    clearObjectConstraints(obj);
    obj.state = 'wrapping'; obj.wrapT = 0; obj.wrapDur = obj.def.wrapDur;
    obj.particle.lastPos.mutableSet(obj.particle.pos);
    obj._wrappingUnit = unit; /* remember which spider is wrapping this */
    unit.wrappingTarget = obj;
    unit.target = null;
  }

  /** Check if a spider role can interact with a prey kind */
  function canCollect(role, kind) {
    if (role === 'collector') return kind === 'drop';  /* green spider: leaves only */
    if (role === 'healer') return false;               /* white spider: no collection, only repairs */
    /* default (fighter): bugs only */
    return kind === 'bug';
  }

  /** Check all spiders for prey collection */
  function tryCollectObjects() {
    for (var ui = 0; ui < spiderUnits.length; ui++) {
      var u = spiderUnits[ui];
      if (u.wrappingTarget !== null) continue; /* this spider is busy */
      var thorax = u.spider.thorax.pos;
      var abdomen = u.spider.abdomen.pos;
      for (var oi = 0; oi < thrownObjects.length; oi++) {
        var obj = thrownObjects[oi];
        if (obj.state !== 'stuck') continue;
        /* Role restriction */
        if (!canCollect(u.role, obj.kind)) continue;
        /* Check this prey isn't already being wrapped by another spider */
        var alreadyWrapping = false;
        for (var uk = 0; uk < spiderUnits.length; uk++) {
          if (spiderUnits[uk].wrappingTarget === obj) { alreadyWrapping = true; break; }
        }
        if (alreadyWrapping) continue;
        var p = obj.particle.pos;
        if (circlesOverlap(thorax.x, thorax.y, 11, p.x, p.y, obj.def.collectRadius)
          || circlesOverlap(abdomen.x, abdomen.y, 19, p.x, p.y, obj.def.collectRadius)) {
          beginWrapping(obj, u);
          break; /* this spider starts wrapping, move to next spider */
        }
      }
    }
  }

  /* ================================================================
     HEALER REPAIR SYSTEM
  ================================================================ */
  var REPAIR_RADIUS = 40;       /* repair broken edges within this radius */
  var REPAIR_MAX_PER_TICK = 999; /* no limit — repair all within radius */
  var REPAIR_SPEED = 0.015;     /* progress per frame (0→1 over ~67 frames ≈ 1.1s) */
  var REPAIR_COOLDOWN = 30;     /* frames between repair bursts per healer */
  var repairingConstraints = []; /* list of constraints currently being repaired */

  /**
   * Find broken edges near a position.
   * Returns array of original edge records that are no longer in spiderweb.constraints.
   */
  function findBrokenEdgesNear(x, y, radius) {
    if (!spiderweb || !spiderweb._originalEdges) return [];
    var r2 = radius * radius;
    /* Build set of currently alive edges (by particle pair) */
    var alive = new Set();
    for (var i = 0; i < spiderweb.constraints.length; i++) {
      var c = spiderweb.constraints[i];
      if (c instanceof DistanceConstraint) {
        /* Use object identity — two particles form a unique pair */
        alive.add(c.a); /* we'll do a different approach: store constraint refs */
      }
    }
    /* Actually, we need to check if original edge {a,b} still exists.
       Build a lookup of alive constraint pairs. */
    var aliveSet = {};
    for (var i = 0; i < spiderweb.constraints.length; i++) {
      var c = spiderweb.constraints[i];
      if (!(c instanceof DistanceConstraint)) continue;
      var idA = c.a.__repId || (c.a.__repId = ++_repIdCounter);
      var idB = c.b.__repId || (c.b.__repId = ++_repIdCounter);
      var key = idA < idB ? idA + '|' + idB : idB + '|' + idA;
      aliveSet[key] = true;
    }

    var broken = [];
    for (var j = 0; j < spiderweb._originalEdges.length; j++) {
      var e = spiderweb._originalEdges[j];
      /* Check if either endpoint particle is near the healer position */
      var dxA = e.a.pos.x - x, dyA = e.a.pos.y - y;
      var dxB = e.b.pos.x - x, dyB = e.b.pos.y - y;
      var distA = dxA * dxA + dyA * dyA;
      var distB = dxB * dxB + dyB * dyB;
      if (distA > r2 && distB > r2) continue;
      /* Check if already alive */
      var idA = e.a.__repId || (e.a.__repId = ++_repIdCounter);
      var idB = e.b.__repId || (e.b.__repId = ++_repIdCounter);
      var key = idA < idB ? idA + '|' + idB : idB + '|' + idA;
      if (aliveSet[key]) continue;
      /* Check if already being repaired */
      if (e._repairingActive) continue;
      broken.push(e);
    }
    return broken;
  }
  var _repIdCounter = 0;

  /**
   * Start repairing edges: create new constraints with gradual tension
   */
  function startRepairEdges(edges) {
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      var currentDist = e.a.pos.sub(e.b.pos).length();
      /* Clamp: if particles drifted very far, start from a reasonable distance */
      if (currentDist > e.distance * 20) currentDist = e.distance * 5;
      var c = new DistanceConstraint(e.a, e.b, 0.05, currentDist);
      c._repairing = true;
      c._repairProgress = 0;
      c._targetDistance = e.distance;
      c._targetStiffness = e.stiffness;
      c._startDistance = currentDist;
      spiderweb.constraints.push(c);
      repairingConstraints.push(c);
      e._repairingActive = true;
      c._originalEdge = e;
    }
  }

  /**
   * Tick all repairing constraints — gradually restore distance & stiffness
   */
  function tickRepairs() {
    for (var i = repairingConstraints.length - 1; i >= 0; i--) {
      var c = repairingConstraints[i];
      c._repairProgress = Math.min(1, c._repairProgress + REPAIR_SPEED);
      var t = c._repairProgress;
      /* Ease in-out */
      var ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      c.distance = c._startDistance + (c._targetDistance - c._startDistance) * ease;
      c.stiffness = 0.05 + (c._targetStiffness - 0.05) * ease;
      if (t >= 1) {
        /* Repair complete */
        c.distance = c._targetDistance;
        c.stiffness = c._targetStiffness;
        c._repairing = false;
        if (c._originalEdge) c._originalEdge._repairingActive = false;
        repairingConstraints.splice(i, 1);
        advanceTutorial('repair_done');
      }
    }
  }

  /**
   * Check if a healer spider should trigger repairs at its current position
   */
  function tryHealerRepair(unit) {
    if (unit.role !== 'healer') return;
    if (unit.wrappingTarget !== null) return;
    /* Cooldown */
    if (!unit._repairCooldown) unit._repairCooldown = 0;
    if (unit._repairCooldown > 0) { unit._repairCooldown--; return; }
    /* Only repair when idle (not moving) */
    if (unit.target) return;

    var hx = unit.spider.thorax.pos.x;
    var hy = unit.spider.thorax.pos.y;
    var broken = findBrokenEdgesNear(hx, hy, REPAIR_RADIUS);
    if (broken.length === 0) return;

    /* Pick up to REPAIR_MAX_PER_TICK closest broken edges */
    broken.sort(function (a, b) {
      var amx = (a.a.pos.x + a.b.pos.x) * 0.5 - hx;
      var amy = (a.a.pos.y + a.b.pos.y) * 0.5 - hy;
      var bmx = (b.a.pos.x + b.b.pos.x) * 0.5 - hx;
      var bmy = (b.a.pos.y + b.b.pos.y) * 0.5 - hy;
      return (amx * amx + amy * amy) - (bmx * bmx + bmy * bmy);
    });
    var toRepair = broken.slice(0, REPAIR_MAX_PER_TICK);
    startRepairEdges(toRepair);
    unit._repairCooldown = REPAIR_COOLDOWN;
  }

  /* ── Stick system helpers ── */
  function _radialRatioAt(x, y) { return radialRatioAt(x, y, W, H, P.webRadius * WEB_SCALE); }
  function _inWebZone(x, y) { return inWebZone(x, y, W, H, P.webRadius * WEB_SCALE); }
  function _getWebOuterR() { return getWebOuterR(W, H, P.webRadius * WEB_SCALE); }

  /* ── updateThrownObjects (mostly unchanged, but wrapping completion uses per-unit) ── */
  function updateThrownObjects() {
    for (var oi = thrownObjects.length - 1; oi >= 0; oi--) {
      var obj = thrownObjects[oi];
      if (!obj || !obj.def) continue;
      var def = obj.def, p = obj.particle;
      obj.animT++;

      if (obj.state === 'falling') {
        var prevX = p.pos.x, prevY = p.pos.y;
        if (obj.kind === 'bug') {
          var bx = obj.baseVx + Math.sin(obj.animT * obj.buzzFreqX + obj.buzzPhaseX) * obj.buzzAmp * 0.08 + Math.cos(obj.animT * obj.buzzFreqX * 1.7 + obj.buzzPhaseX) * obj.buzzAmp * 0.04 + (Math.random() - 0.5) * 0.5;
          var by = obj.baseVy + Math.sin(obj.animT * obj.buzzFreqY + obj.buzzPhaseY) * obj.buzzAmp * 0.08 + Math.cos(obj.animT * obj.buzzFreqY * 2.1 + obj.buzzPhaseY) * obj.buzzAmp * 0.04 + (Math.random() - 0.5) * 0.5;
          if (!obj.released && Math.random() < 0.018) { obj.baseVx = (Math.random() - 0.5) * 5; obj.baseVy = (Math.random() - 0.5) * 5; }
          p.pos.x += bx; p.pos.y += by; p.lastPos.x = p.pos.x - bx; p.lastPos.y = p.pos.y - by;
          obj.angle = Math.atan2(by, bx); obj.wingT += 0.55;
          if (!obj._buzzStarted) { obj._buzzStarted = true; audioEngine.startBugBuzz(oi); }
          var offScreen = p.pos.x < -80 || p.pos.x > W + 80 || p.pos.y < -80 || p.pos.y > H + 80;
          var timeout = obj.released && (obj.animT - obj._releaseFrame > 200);
          if (offScreen || timeout) { audioEngine.stopBugBuzz(oi); obj.destroy(sim); thrownObjects.splice(oi, 1); updateBadge(obj.kind, -1); continue; }
        } else {
          obj.angleVel += (Math.random() - 0.5) * obj.angleTurb; obj.angleVel *= obj.angleDrag;
          obj.angleVel = Math.max(-0.025, Math.min(0.025, obj.angleVel)); obj.angle += obj.angleVel;
          if (obj.angle > 1.4) obj.angleVel -= 0.004; if (obj.angle < -1.4) obj.angleVel += 0.004;
          obj.vx += Math.sin(obj.angle) * obj.glideForce; obj.vy += obj.grav;
          obj.vx *= obj.drag; obj.vy *= obj.drag;
          var spd = Math.sqrt(obj.vx * obj.vx + obj.vy * obj.vy);
          if (spd > 0.8) { obj.vx = obj.vx / spd * 0.8; obj.vy = obj.vy / spd * 0.8; }
          p.pos.x += obj.vx; p.pos.y += obj.vy; p.lastPos.x = p.pos.x - obj.vx; p.lastPos.y = p.pos.y - obj.vy;
          if (p.pos.y > H + 60) { obj.destroy(sim); thrownObjects.splice(oi, 1); updateBadge(obj.kind, -1); continue; }
        }
        /* C方案粘网 */
        var stepLen = Math.sqrt((p.pos.x - prevX) * (p.pos.x - prevX) + (p.pos.y - prevY) * (p.pos.y - prevY));
        if (!obj.released && (_inWebZone(p.pos.x, p.pos.y) || obj.enteredWebZone)) {
          if (!obj.enteredWebZone) {
            obj.enteredWebZone = true; obj.penetrationDist = 0; obj.hitHistory = [];
            var outerR = _getWebOuterR();
            var minDelay = P.stickDelayMin * outerR, maxDelay = P.stickDelayMax * outerR;
            if (maxDelay < minDelay) maxDelay = minDelay;
            obj.stickDelay = minDelay + Math.random() * (maxDelay - minDelay);
          }
          obj.penetrationDist += stepLen;
          var newHits = collectPathHitCandidates(prevX, prevY, p.pos.x, p.pos.y, P.stickCatchRadius, spiderweb, _radialRatioAt);
          for (var hi = 0; hi < newHits.length; hi++) {
            newHits[hi].penetration = obj.penetrationDist;
            var last = obj.hitHistory.length ? obj.hitHistory[obj.hitHistory.length - 1] : null;
            if (last) { var dxh = last.x - newHits[hi].x, dyh = last.y - newHits[hi].y; if (dxh * dxh + dyh * dyh < 16) continue; }
            obj.hitHistory.push(newHits[hi]);
          }
          if (obj.hitHistory.length > P.stickHistory) obj.hitHistory.splice(0, obj.hitHistory.length - P.stickHistory);
          if (obj.penetrationDist >= obj.stickDelay && obj.hitHistory.length) {
            var chosen = chooseStickCandidate(obj.hitHistory, spiderweb, P.stickMidBias);
            if (chosen) obj.stickToPoint(chosen, spiderweb);
          }
          if (!_inWebZone(p.pos.x, p.pos.y) && obj.state === 'falling') { obj.enteredWebZone = false; obj.penetrationDist = 0; obj.hitHistory = []; }
        }
        if (obj.kind !== 'bug' && p.pos.y > H + 60) { obj.destroy(sim); thrownObjects.splice(oi, 1); updateBadge(obj.kind, -1); }
      } else if (obj.state === 'sticking') {
        obj.stickT = Math.min(1, obj.stickT + 0.06);
        var ease = obj.stickT < 0.5 ? 2 * obj.stickT * obj.stickT : -1 + (4 - 2 * obj.stickT) * obj.stickT;
        if (obj.cA) obj.cA.distance = obj.stickyFromA + (obj.stickyToA - obj.stickyFromA) * ease;
        if (obj.cB) obj.cB.distance = obj.stickyFromB + (obj.stickyToB - obj.stickyFromB) * ease;
        if (obj.stickT >= 1) {
          if (obj.cA) obj.cA.distance = obj.stickyToA; if (obj.cB) obj.cB.distance = obj.stickyToB;
          obj.state = 'stuck'; obj.stayTimer = 0;
          if (obj.kind === 'bug') audioEngine.stopBugBuzz(thrownObjects.indexOf(obj));
          audioEngine.playSfxLand(obj.kind);
          if (obj.kind === 'bug') obj.wobbleAmp = 0.28;
          else if (obj.kind === 'drop') obj.wobbleAmp = 0.04;
        }
      } else if (obj.state === 'stuck') {
        obj.stayTimer++;
        var sagRate = obj.kind === 'bug' ? 0.06 : 0.008;
        p.pos.y += sagRate;
        if (obj.kind === 'bug') { p.pos.x += (Math.random() - 0.5) * obj.wobbleAmp * 2; p.pos.y += (Math.random() - 0.5) * obj.wobbleAmp; obj.wingT += 0.55; }
        else { obj.angleVel += (Math.random() - 0.5) * 0.0005; obj.angleVel *= 0.98; obj.angle += obj.angleVel; }
        if (obj.kind !== 'drop') {
          var ramp = Math.max(0, obj.stayFrames - 72);
          if (obj.stayTimer > ramp) {
            var progress = (obj.stayTimer - ramp) / Math.max(1, obj.stayFrames - ramp);
            var wobbleMax = obj.kind === 'bug' ? 9.0 : 1.5;
            obj.wobbleAmp = Math.min(wobbleMax, obj.wobbleAmp + (0.08 + progress * 0.18));
            if (obj.kind === 'bug') obj.wingT += progress * 0.8;
          }
          if (obj.stayTimer >= obj.stayFrames) { obj.state = 'freeing'; obj.freeTimer = 0; }
        }
      } else if (obj.state === 'freeing') {
        obj.freeTimer++;
        var thrash = obj.kind === 'bug' ? 14 : 4;
        p.pos.x += (Math.random() - 0.5) * thrash; p.pos.y += (Math.random() - 0.5) * (thrash * 0.6);
        if (obj.freeTimer > 28) { obj.release(spiderweb, webBreakFlashes, _breakFrame); webScanPending = 12; advanceTutorial('bug_released'); }
      } else if (obj.state === 'falling2') {
        if (obj.kind === 'drop') {
          obj.angleVel += (Math.random() - 0.5) * obj.angleTurb; obj.angleVel *= obj.angleDrag; obj.angle += obj.angleVel;
          obj.vx += Math.sin(obj.angle) * obj.glideForce; obj.vy += obj.grav; obj.vx *= obj.drag; obj.vy *= obj.drag;
          var spd2 = Math.sqrt(obj.vx * obj.vx + obj.vy * obj.vy);
          if (spd2 > 0.8) { obj.vx = obj.vx / spd2 * 0.8; obj.vy = obj.vy / spd2 * 0.8; }
          p.pos.x += obj.vx; p.pos.y += obj.vy;
        } else { p.pos.y += obj.grav; }
        obj.alpha = Math.max(0, obj.alpha - 0.016);
        if (obj.alpha <= 0) { obj.destroy(sim); thrownObjects.splice(oi, 1); updateBadge(obj.kind, -1); }
      } else if (obj.state === 'wrapping') {
        p.lastPos.mutableSet(p.pos);
        obj.wrapT = Math.min(1, obj.wrapT + 1 / obj.wrapDur);
        if (Math.round(obj.wrapT * obj.wrapDur) % 12 === 0) audioEngine.playSfxWrap(obj.wrapT);
        if (obj.wrapT >= 1) {
          var wrapUnit = obj._wrappingUnit;
          if (wrapUnit) wrapUnit.wrappingTarget = null;

          if (obj.kind === 'bug') {
            /* ── Attack complete: destroy fly instantly ── */
            audioEngine.playCollectSound(obj.kind);
            playCollectFX(obj, screenShellEl, canvas, collectLayer, W, H, FOOD_VALUES);
            addFood(obj.kind);
            audioEngine.stopBugBuzz(thrownObjects.indexOf(obj));
            obj.destroy(sim);
            thrownObjects.splice(oi, 1);
            updateBadge(obj.kind, -1);
            advanceTutorial('kill_bug');
          } else {
            /* ── Collect (leaf): fly toward progress bar ── */
            audioEngine.playCollectSound(obj.kind);
            playCollectFX(obj, screenShellEl, canvas, collectLayer, W, H, FOOD_VALUES);
            beginCollectObject(obj, wrapUnit);
          }
        }
      } else if (obj.state === 'collecting') {
        var drawX = obj.collectFromX, drawY = obj.collectFromY, scale = 1, opacity = 1;
        if (obj.collectPause > 0) {
          obj.collectPause--; obj.collectFlash++;
          var holdT = 1 - obj.collectPause / 12; var pulse = Math.sin(holdT * Math.PI * 3.2) * 0.18;
          drawX += Math.sin(obj.collectFlash * 0.9) * 1.8; drawY += Math.cos(obj.collectFlash * 0.8) * 1.1;
          scale = 1.05 + holdT * 0.42 + pulse; opacity = 0.82 + Math.abs(Math.sin(holdT * Math.PI * 4)) * 0.18;
        } else {
          obj.travelT = Math.min(1, obj.travelT + 1 / obj.collectDur);
          var easeIn = obj.travelT * obj.travelT * obj.travelT;
          drawX = obj.collectFromX + (obj.collectToX - obj.collectFromX) * easeIn;
          drawY = obj.collectFromY + (obj.collectToY - obj.collectFromY) * easeIn;
          scale = 1.32 - (0.5 * obj.travelT); opacity = 1 - obj.travelT * 0.08;
        }
        if (obj.collectEl) { obj.collectEl.style.left = drawX + 'px'; obj.collectEl.style.top = drawY + 'px'; obj.collectEl.style.transform = 'scale(' + scale + ')'; obj.collectEl.style.opacity = String(opacity); }
        if (obj.travelT >= 1) {
          if (obj.collectEl && obj.collectEl.parentNode) obj.collectEl.parentNode.removeChild(obj.collectEl);
          obj.collectEl = null; obj.collectCanvas = null;
          addFood(obj.kind); obj.destroy(sim); thrownObjects.splice(oi, 1); updateBadge(obj.kind, -1);
        }
      }
    }
  }

  /* ── Panel init ── */
  initPanel(P, DEFAULTS, {
    buildWeb: buildWeb,
    buildSpider: buildSpiders,
    onMotionChange: function () {
      moveSpeed = P.moveSpeed; STEP_SPEED = P.stepSpeed;
      STEP_THRESH = P.stepThresh; REST_THRESH = P.restThresh;
    },
    clearAllObjects: clearAllObjects,
    launchObject: launchObject
  });

  /* ── 背景控制面板初始化 ── */
  (function initBgPanel() {
    /* 主题色点 */
    var dotsEl = document.getElementById('bg-theme-dots');
    if (dotsEl) {
      var themeColors = ['#5a8a5a','#c8a040','#7a5a8a','#d07a8a','#3a4a6a'];
      for (var i = 0; i < BG_THEMES.length; i++) {
        var dot = document.createElement('div');
        dot.className = 'bg-theme-dot' + (i === P.bgTheme ? ' active' : '');
        dot.style.background = themeColors[i] || '#888';
        dot.dataset.idx = i;
        dot.onclick = (function(idx, d) { return function() {
          P.bgTheme = idx; switchSylvanTheme(idx);
          dotsEl.querySelectorAll('.bg-theme-dot').forEach(function(dd){ dd.classList.remove('active'); });
          d.classList.add('active');
          if (P.bgMusicOn) audioEngine.playLevelBGM(idx);
        }; })(i, dot);
        dotsEl.appendChild(dot);
      }
    }
    switchSylvanTheme(P.bgTheme);
    /* 滑块 */
    function bgSlider(id, prop, fn) {
      var el = document.getElementById(id);
      if (!el) return;
      el.value = P[prop]; var lbl = document.getElementById('lbl-' + prop);
      if (lbl) lbl.textContent = P[prop];
      el.addEventListener('input', function() {
        P[prop] = parseFloat(this.value); if (lbl) lbl.textContent = P[prop]; if (fn) fn(P[prop]);
      });
    }
    bgSlider('sl-bgBlur', 'bgBlur', function(v){ bgConfig.blurScale = v / 100; applyBgBlur(); });
    bgSlider('sl-bgWind', 'bgWind', function(v){ bgConfig.windSpeed = v; });
    bgSlider('sl-bgRay', 'bgRay', function(v){ bgConfig.rayOpacity = v / 100; });
    bgSlider('sl-bgPart', 'bgPart', function(v){ setBgParticleCount(Math.round(v)); });
    bgSlider('sl-bgVol', 'bgVol', function(v){ audioEngine.setVolume(v / 100); });
    /* 应用初始值 */
    bgConfig.blurScale = P.bgBlur / 100; applyBgBlur();
    bgConfig.windSpeed = P.bgWind;
    bgConfig.rayOpacity = P.bgRay / 100;
    setBgParticleCount(Math.round(P.bgPart));
    if (audioEngine.setVolume) audioEngine.setVolume(P.bgVol / 100);
    /* BGM 开关 */
    var bgmBtn = document.getElementById('bg-bgm-toggle');
    if (bgmBtn) {
      function updateBgmBtn() { bgmBtn.textContent = P.bgMusicOn ? 'BGM ON' : 'BGM OFF'; bgmBtn.className = 'btn ' + (P.bgMusicOn ? 'bgm-on' : 'btn-secondary'); }
      updateBgmBtn();
      bgmBtn.onclick = function() {
        P.bgMusicOn = P.bgMusicOn ? 0 : 1;
        if (P.bgMusicOn) audioEngine.playLevelBGM(P.bgTheme); else audioEngine.stopBGM();
        updateBgmBtn();
      };
    }
    /* 自动启动 BGM */
    if (P.bgMusicOn) setTimeout(function(){ audioEngine.playLevelBGM(P.bgTheme); }, 500);
  })();

  /* ================================================================
     MAIN LOOP
  ================================================================ */
  var loop = function () {
    /* ── Sylvan 背景（始终运行，包括 IDLE） ── */
    _smoothDrag.x += (_dragOffset.x - _smoothDrag.x) * 0.1;
    _smoothDrag.y += (_dragOffset.y - _smoothDrag.y) * 0.1;
    updateSylvanBackground(1.0, false, _smoothDrag, 0, 0);
    renderSylvanBackground();

    if (gameState === 'IDLE' || gameState === 'GAME_OVER') {
      updateLevelTimer(); requestAnimFrame(loop); return;
    }

    updateSamplePoints(samplePoints);

    /* ── Per-spider movement & feet ── */
    for (var ui = 0; ui < spiderUnits.length; ui++) {
      var u = spiderUnits[ui];
      var spider = u.spider;
      var isWrapping = (u.wrappingTarget !== null);

      /* Movement */
      u.moveDir = null;
      if (isWrapping) {
        u.target = null;
      } else if (u.target) {
        /* If targeting a prey, track its current position */
        if (u._targetPrey && u._targetPrey.state === 'stuck') {
          u.target.x = u._targetPrey.particle.pos.x;
          u.target.y = u._targetPrey.particle.pos.y;
        } else if (u._targetPrey) {
          /* Prey is no longer stuck (escaped or collected) — cancel */
          u._targetPrey = null;
        }

        var tx = spider.thorax.pos, dx = u.target.x - tx.x, dy = u.target.y - tx.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > arriveThreshold) {
          var nx = (dx / dist) * moveSpeed, ny = (dy / dist) * moveSpeed;
          u.moveDir = new Vec2(dx / dist, dy / dist);
          for (var p = 0; p < spider.particles.length; p++) {
            spider.particles[p].pos.x += nx; spider.particles[p].pos.y += ny;
            spider.particles[p].lastPos.x += nx; spider.particles[p].lastPos.y += ny;
          }
        } else {
          u.target = null; u._targetPrey = null;
        }
      }

      /* Feet */
      for (var fi = 0; fi < u.footState.length; fi++) {
        var fs = u.footState[fi];
        if (fs.cooldown > 0) fs.cooldown--;
        if (fs.stepping) {
          fs.t = Math.min(1, fs.t + STEP_SPEED);
          var ease = fs.t < 0.5 ? 2 * fs.t * fs.t : -1 + (4 - 2 * fs.t) * fs.t;
          fs.current.x = fs.from.x + (fs.targetPos.x - fs.from.x) * ease;
          fs.current.y = fs.from.y + (fs.targetPos.y - fs.from.y) * ease;
          fs.particle.pos.mutableSet(fs.current); fs.particle.lastPos.mutableSet(fs.current);
          if (fs.t >= 1) {
            fs.current.x = fs.targetPos.x; fs.current.y = fs.targetPos.y;
            fs.particle.pos.mutableSet(fs.current); fs.particle.lastPos.mutableSet(fs.current);
            fs.stepping = false; landFoot(fs, spider);
          }
        } else {
          if (fs.landedNode) { fs.current.x = fs.landedNode.pos.x; fs.current.y = fs.landedNode.pos.y; }
          else if (fs.landedSeg) { var sp = fs.landedSeg; fs.current.x = sp.pa.pos.x + (sp.pb.pos.x - sp.pa.pos.x) * sp.t; fs.current.y = sp.pa.pos.y + (sp.pb.pos.y - sp.pa.pos.y) * sp.t; }
          if (fs.landedNode || fs.landedSeg) { fs.particle.pos.mutableSet(fs.current); fs.particle.lastPos.mutableSet(fs.current); }
          var drift2 = fs.current.dist2(spider.thorax.pos);
          var partner = u.footState[fi % 2 === 0 ? fi + 1 : fi - 1];
          var ps = partner && partner.stepping;
          if (!ps) {
            if (u.target && drift2 > STEP_THRESH * STEP_THRESH) triggerStep(fi, u.moveDir, u.footState, spiderweb, spider, samplePoints, u.moveDir, STEP_COOLDOWN);
            else if (!u.target && drift2 > REST_THRESH * REST_THRESH) triggerStep(fi, null, u.footState, spiderweb, spider, samplePoints, u.moveDir, STEP_COOLDOWN);
          }
        }
      }
    }

    /* 断网红闪帧计数 */
    _breakFrame++;
    if (webBreakFlashes.length > 0)
      webBreakFlashes = webBreakFlashes.filter(function (f) { return _breakFrame - f.t < 20; });

    /* wave system */
    updateLevelTimer();
    updateLevelSpawner();
    checkWebIntegrity();

    /* thrown objects */
    tryCollectObjects();
    updateThrownObjects();
    if (pendingLevelCheck) { pendingLevelCheck = false; checkLevelComplete(); }

    /* healer repair system */
    for (var hi = 0; hi < spiderUnits.length; hi++) tryHealerRepair(spiderUnits[hi]);
    tickRepairs();

    /* blink — each spider independently */
    for (var bi = 0; bi < spiderUnits.length; bi++) updateBlink(spiderUnits[bi].blinkState);

    sim.frame(16);
    sim.draw();
    drawThrownObjects(sim.ctx, thrownObjects);

    /* Draw all spiders */
    for (var ri = 0; ri < spiderUnits.length; ri++) {
      var su = spiderUnits[ri];
      if (su.spider && su.spider.drawConstraints) su.spider.drawConstraints(sim.ctx, su.spider);
    }

    /* Draw drag line on top */
    drawDragLine(sim.ctx);

    requestAnimFrame(loop);
  };
  loop();
};
