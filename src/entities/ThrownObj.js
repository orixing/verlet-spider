import { Vec2 } from '../engine/Vec2.js';
import { Particle } from '../engine/Particle.js';
import { DistanceConstraint } from '../engine/constraints.js';
import { Composite } from '../engine/Composite.js';
import { audioEngine } from '../audio/audioEngine.js';

/**
 * 获取物体定义参数（boulder 已移除）
 */
export function getObjectDef(kind, P, gameState, getLevelCfgFn, currentLevel) {
  var waveCfg = (gameState === 'LEVEL_ACTIVE' || gameState === 'LEVEL_INTRO')
    ? getLevelCfgFn(currentLevel) : null;
  if (kind === 'bug') {
    var flyScale = (waveCfg && waveCfg.flyReleaseScale) ? waveCfg.flyReleaseScale : 1;
    return {
      r: 9, collectRadius: 5, weight: P.flyWeight,
      stayFrames: Math.round(P.flyReleaseSec * 60 * flyScale),
      gravity: 0, wrapDur: 240  /* 攻击时间 4秒 */
    };
  }
  /* drop (leaf) */
  return {
    r: 14, collectRadius: 12, weight: P.leafWeight,
    stayFrames: Math.round(P.leafReleaseSec * 60),
    gravity: 0.06, wrapDur: 180  /* 采集时间 3秒 */
  };
}

/**
 * 投掷物体构造函数
 */
export function ThrownObj(kind, W, H, sim, P, gameState, getLevelCfgFn, currentLevel) {
  var def = getObjectDef(kind, P, gameState, getLevelCfgFn, currentLevel);
  this.kind = kind; this.def = def;
  this.state = 'falling';
  this.alpha = 1;
  this.stayTimer = 0;
  this.stayFrames = def.stayFrames;
  this.animT = 0;
  this.wobbleAmp = 0;
  this.stickT = 0;
  this.stickyFromA = 0; this.stickyFromB = 0;
  this.stickyToA = 0; this.stickyToB = 0;
  this.cA = null; this.cB = null;
  this.stuckOnConstraint = null;
  this.freeTimer = 0;
  this.angle = 0;
  this.wingT = 0;
  this.grav = 0.3;
  this.angleVel = 0;
  this.prevX = 0; this.prevY = 0;
  this.stuckAngle = 0;
  this.enteredWebZone = false;
  this.penetrationDist = 0;
  this.stickDelay = 0;
  this.hitHistory = [];
  this.released = false;
  this.collectT = 0;
  this.collectDur = 24;
  this.collectPause = 0;
  this.collectFlash = 0;
  this.travelT = 0;
  this.collectFromX = 0; this.collectFromY = 0;
  this.collectToX = 0; this.collectToY = 0;
  this.collectEl = null;
  this.collectCanvas = null;
  this.wrapT = 0;
  this.wrapDur = 0;

  var sx, sy, svx = 0, svy = 0;

  if (kind === 'bug') {
    var edge = Math.floor(Math.random() * 4);
    if (edge === 0) { sx = -20; sy = H * 0.05 + Math.random() * H * 0.9; svx = 2.2 + Math.random() * 1.2; svy = (Math.random() - 0.5) * 2; }
    else if (edge === 1) { sx = W + 20; sy = H * 0.05 + Math.random() * H * 0.9; svx = -2.2 - Math.random() * 1.2; svy = (Math.random() - 0.5) * 2; }
    else if (edge === 2) { sx = W * 0.05 + Math.random() * W * 0.9; sy = -20; svx = (Math.random() - 0.5) * 2; svy = 2.2 + Math.random() * 1.2; }
    else { sx = W * 0.05 + Math.random() * W * 0.9; sy = H + 20; svx = (Math.random() - 0.5) * 2; svy = -2.2 - Math.random() * 1.2; }
    this.grav = def.gravity;
    this.svx = svx; this.svy = svy;
    this.buzzFreqX = 0.06 + Math.random() * 0.06;
    this.buzzFreqY = 0.05 + Math.random() * 0.05;
    this.buzzAmp = 14 + Math.random() * 10;
    this.buzzPhaseX = Math.random() * Math.PI * 2;
    this.buzzPhaseY = Math.random() * Math.PI * 2;
    var tcx = W * 0.3 + Math.random() * W * 0.4;
    var tcy = H * 0.3 + Math.random() * H * 0.4;
    var dx0 = tcx - sx, dy0 = tcy - sy;
    var dd0 = Math.sqrt(dx0 * dx0 + dy0 * dy0) || 1;
    this.baseVx = dx0 / dd0 * 2.5;
    this.baseVy = dy0 / dd0 * 2.5;
  } else {
    /* drop (leaf) */
    sx = W * 0.15 + Math.random() * W * 0.7; sy = -5;
    this.grav = def.gravity;
    this.vx = 0; this.vy = 0;
    this.drag = 0.92;
    this.angle = (Math.random() - 0.5) * 1.0;
    this.angleVel = (Math.random() - 0.5) * 0.02;
    this.angleDrag = 0.97;
    this.angleTurb = 0.003;
    this.glideForce = 0.055;
  }

  this.prevX = sx; this.prevY = sy;
  this.particle = new Particle(new Vec2(sx, sy));
  this.particle.lastPos.mutableSet(new Vec2(sx - svx, sy - svy));
  this.comp = new Composite();
  this.comp.particles.push(this.particle);
  this.comp.drawParticles = function () { };
  this.comp.drawConstraints = function () { };
  sim.composites.push(this.comp);
}

export function clearObjectConstraints(obj) {
  if (obj.cA) {
    var i = obj.comp.constraints.indexOf(obj.cA);
    if (i !== -1) obj.comp.constraints.splice(i, 1);
    obj.cA = null;
  }
  if (obj.cB) {
    var j = obj.comp.constraints.indexOf(obj.cB);
    if (j !== -1) obj.comp.constraints.splice(j, 1);
    obj.cB = null;
  }
}

ThrownObj.prototype.stickToPoint = function (pt, spiderweb) {
  if (!pt) return false;
  if (spiderweb.constraints.indexOf(pt.c) === -1) return false;
  var p = this.particle;
  var dA = p.pos.dist(pt.c.a.pos);
  var dB = p.pos.dist(pt.c.b.pos);
  this.stickyFromA = dA;
  this.stickyFromB = dB;
  this.stickyToA = Math.max(this.def.r * 0.4, dA * 0.35);
  this.stickyToB = Math.max(this.def.r * 0.4, dB * 0.35);
  this.cA = new DistanceConstraint(p, pt.c.a, 0.95, dA);
  this.cB = new DistanceConstraint(p, pt.c.b, 0.95, dB);
  this.comp.constraints.push(this.cA);
  this.comp.constraints.push(this.cB);
  this.stuckOnConstraint = pt.c;
  var radial = Math.min(1, pt.radial || 0);
  this.stayFrames = Math.max(30, Math.round(this.def.stayFrames * (1 - radial / 3)));
  this.stuckAngle = 0;
  this.state = 'sticking'; this.stickT = 0;

  /* 粘网冲击 */
  var ivx = p.pos.x - p.lastPos.x;
  var ivy = p.pos.y - p.lastPos.y;
  var impactScale = this.def.weight * 1.8;
  var idx = ivx * impactScale, idy = ivy * impactScale;
  pt.c.a.pos.x += idx; pt.c.a.pos.y += idy;
  pt.c.b.pos.x += idx; pt.c.b.pos.y += idy;
  var bounceFactor = this.def.weight * 1.2;
  pt.c.a.lastPos.x += ivx * bounceFactor;
  pt.c.b.lastPos.x += ivx * bounceFactor;

  return true;
};

/**
 * 苍蝇挣脱 — 断开粘附点，飞向网内新位置（不飞出屏幕）
 * 树叶挣脱 — 不会挣脱（stayFrames=0），但保留 fallback
 */
ThrownObj.prototype.release = function (spiderweb, webBreakFlashes, _breakFrame) {
  var p = this.particle;
  clearObjectConstraints(this);
  audioEngine.playSfxEscape();

  /* 断开粘附网线 + 区域破坏 + 红闪 */
  if (this.stuckOnConstraint) {
    var bc = this.stuckOnConstraint;
    webBreakFlashes.push({
      ax: bc.a.pos.x, ay: bc.a.pos.y,
      bx: bc.b.pos.x, by: bc.b.pos.y,
      t: _breakFrame
    });
    var wi = spiderweb.constraints.indexOf(bc);
    if (wi !== -1) spiderweb.constraints.splice(wi, 1);
    this.stuckOnConstraint = null;
  }

  /* 苍蝇挣脱：破坏周围 24px 半径内的网线 */
  if (this.kind === 'bug') {
    var bpx = p.pos.x, bpy = p.pos.y, breakR2 = 24 * 24;
    var removed = [];
    spiderweb.constraints = spiderweb.constraints.filter(function (c) {
      if (!(c instanceof DistanceConstraint)) return true;
      var ax = c.a.pos.x - bpx, ay = c.a.pos.y - bpy;
      var bx2 = c.b.pos.x - bpx, by2 = c.b.pos.y - bpy;
      var keep = (ax * ax + ay * ay > breakR2) || (bx2 * bx2 + by2 * by2 > breakR2);
      if (!keep) removed.push(c);
      return keep;
    });
    for (var ri = 0; ri < removed.length; ri++) {
      webBreakFlashes.push({
        ax: removed[ri].a.pos.x, ay: removed[ri].a.pos.y,
        bx: removed[ri].b.pos.x, by: removed[ri].b.pos.y,
        t: _breakFrame
      });
    }
  }

  var W = this._W, H = this._H;

  if (this.kind === 'bug') {
    /* ── 苍蝇：飞向网内随机新位置，重新粘网 ── */
    this.state = 'falling';
    this.grav = 0;
    this.enteredWebZone = false;
    this.hitHistory = [];
    this.penetrationDist = 0;
    this.released = false; /* NOT released — will re-stick */
    this.stayTimer = 0;
    this.wobbleAmp = 0;
    this._releaseFrame = this.animT;

    /* 目标：网中心附近随机点 */
    var targetX = W * 0.25 + Math.random() * W * 0.5;
    var targetY = H * 0.25 + Math.random() * H * 0.5;
    var dx = targetX - p.pos.x, dy = targetY - p.pos.y;
    var dl = Math.sqrt(dx * dx + dy * dy) || 1;
    var flySpeed = 3 + Math.random() * 2;
    this.baseVx = (dx / dl) * flySpeed;
    this.baseVy = (dy / dl) * flySpeed;
    this.buzzFreqX = 0.08 + Math.random() * 0.06;
    this.buzzFreqY = 0.07 + Math.random() * 0.05;
    this.buzzAmp = 10 + Math.random() * 8;
    this.buzzPhaseX = Math.random() * Math.PI * 2;
    this.buzzPhaseY = Math.random() * Math.PI * 2;
    p.lastPos.x = p.pos.x - this.baseVx;
    p.lastPos.y = p.pos.y - this.baseVy;
  } else {
    /* drop: shouldn't happen (leaves don't escape), but fallback */
    this.state = 'falling2';
    var currentVx = p.pos.x - p.lastPos.x;
    var currentVy = p.pos.y - p.lastPos.y;
    p.lastPos.x = p.pos.x - currentVx;
    p.lastPos.y = p.pos.y - (currentVy + this.def.weight * 0.45);
  }
};

ThrownObj.prototype.destroy = function (sim) {
  var i = sim.composites.indexOf(this.comp);
  if (i !== -1) sim.composites.splice(i, 1);
};
