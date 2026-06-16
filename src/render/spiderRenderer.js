import { DistanceConstraint } from '../engine/constraints.js';

/**
 * 颜色方案 — 按角色区分
 * default: 原始黑色
 * collector: 绿色
 * fighter: 红色（预留）
 * healer: 白色（预留）
 */
var COLOR_SCHEMES = {
  default: {
    legBone:   ['#1a1a1a', '#222', '#2a2a2a', '#333'],
    legWrap:   '#2a2a2a',
    legIdle:   '#333',
    foot:      '#111',
    thorax:    '#1a1a1a',
    abdomen:   '#1a1a1a',
    abdomenHL: 'rgba(255,255,255,0.08)',
    eyeWhite:  '#f0f0c0',
    eyePupil:  '#222'
  },
  collector: {
    legBone:   ['#1a3a1a', '#1e4420', '#224e26', '#2a5a30'],
    legWrap:   '#1e4420',
    legIdle:   '#2a5a30',
    foot:      '#0a2a0a',
    thorax:    '#1a3a1a',
    abdomen:   '#1a4018',
    abdomenHL: 'rgba(120,255,120,0.10)',
    eyeWhite:  '#c0f0c0',
    eyePupil:  '#1a3a1a'
  },
  fighter: {
    legBone:   ['#3a1a1a', '#441e1e', '#4e2222', '#5a2a2a'],
    legWrap:   '#441e1e',
    legIdle:   '#5a2a2a',
    foot:      '#2a0a0a',
    thorax:    '#3a1a1a',
    abdomen:   '#401818',
    abdomenHL: 'rgba(255,120,120,0.10)',
    eyeWhite:  '#f0c0c0',
    eyePupil:  '#3a1a1a'
  },
  healer: {
    legBone:   ['#2a2a2a', '#3a3a3a', '#4a4a4a', '#5a5a5a'],
    legWrap:   '#3a3a3a',
    legIdle:   '#5a5a5a',
    foot:      '#1a1a1a',
    thorax:    '#3a3a3a',
    abdomen:   '#444',
    abdomenHL: 'rgba(255,255,255,0.15)',
    eyeWhite:  '#f0f0f0',
    eyePupil:  '#2a2a2a'
  }
};

/**
 * 设置蜘蛛的自定义绘制函数
 * @param {string} role - 角色类型: 'default' | 'collector' | 'fighter' | 'healer'
 */
export function setupSpiderDraw(spider, legConstraintCount, footState, blinkState, getWrappingTarget, role) {
  var C = COLOR_SCHEMES[role] || COLOR_SCHEMES['default'];

  spider.drawConstraints = function (ctx, comp) {
    var wrappingTarget = getWrappingTarget();

    for (var i = 3; i < legConstraintCount; ++i) {
      var con = comp.constraints[i];
      if (!(con instanceof DistanceConstraint)) continue;
      ctx.beginPath(); ctx.moveTo(con.a.pos.x, con.a.pos.y); ctx.lineTo(con.b.pos.x, con.b.pos.y);
      var s = 9, ip = (i - 3) % s;
      if (ip <= 1) { ctx.strokeStyle = C.legBone[0]; ctx.lineWidth = 6; }
      else if (ip <= 3) { ctx.strokeStyle = C.legBone[1]; ctx.lineWidth = 4; }
      else if (ip <= 5) { ctx.strokeStyle = C.legBone[2]; ctx.lineWidth = 3; }
      else { ctx.strokeStyle = C.legBone[3]; ctx.lineWidth = 2; }
      ctx.stroke();
    }

    /* 打包方向向量 */
    var wrapOX = 0, wrapOY = 0, wrapOL = 1, wrapT2 = 0, wrapAt = 0, wrapSpeed = 0;
    if (wrappingTarget) {
      var wo = wrappingTarget;
      wrapOX = wo.particle.pos.x - spider.thorax.pos.x;
      wrapOY = wo.particle.pos.y - spider.thorax.pos.y;
      wrapOL = Math.sqrt(wrapOX * wrapOX + wrapOY * wrapOY) || 1;
      wrapOX /= wrapOL; wrapOY /= wrapOL;
      wrapT2 = wo.wrapT;
      wrapAt = wo.animT;
      wrapSpeed = wrapT2 * wo.wrapDur * 0.58;
    }

    var thoraxDX = 0, thoraxDY = 0, abdomenDX = 0, abdomenDY = 0;
    if (wrappingTarget) {
      var lean = 4 * wrapT2;
      thoraxDX = wrapOX * lean; thoraxDY = wrapOY * lean;
      abdomenDX = -wrapOX * lean * 0.4; abdomenDY = -wrapOY * lean * 0.4;
    }

    for (var fi = 0; fi < footState.length; fi++) {
      var fs = footState[fi];
      var drawCX = fs.current.x, drawCY = fs.current.y;
      var prevCX = drawCX, prevCY = drawCY;

      if (wrappingTarget) {
        var perpX = -wrapOY, perpY = wrapOX;
        if (fi === 0 || fi === 1) {
          var phase = (fi === 0) ? 0 : Math.PI;
          var speedT = wrapSpeed + phase;
          var reach = 16 + wrapT2 * 8;
          var lateral = 12 * wrapT2;
          drawCX += wrapOX * Math.sin(speedT) * reach + perpX * Math.cos(speedT * 0.7 + phase) * lateral;
          drawCY += wrapOY * Math.sin(speedT) * reach + perpY * Math.cos(speedT * 0.7 + phase) * lateral;
        } else {
          var phase2 = (fi === 2) ? 0 : Math.PI;
          var backSwing = Math.sin(wrapSpeed * 0.5 + phase2) * 7 * wrapT2;
          drawCX += -wrapOX * Math.abs(Math.sin(wrapSpeed * 0.5 + phase2)) * 4 + perpX * backSwing * 0.6;
          drawCY += -wrapOY * Math.abs(Math.sin(wrapSpeed * 0.5 + phase2)) * 4 + perpY * backSwing * 0.6;
        }
        ctx.beginPath(); ctx.moveTo(prevCX, prevCY); ctx.lineTo(drawCX, drawCY);
        ctx.strokeStyle = 'rgba(80,80,80,0.28)'; ctx.lineWidth = 1.5; ctx.stroke();
      }

      ctx.beginPath(); ctx.moveTo(fs.particle.pos.x, fs.particle.pos.y);
      ctx.lineTo(drawCX, drawCY);
      ctx.strokeStyle = wrappingTarget ? C.legWrap : C.legIdle;
      ctx.lineWidth = wrappingTarget ? 2.5 : 2;
      ctx.stroke();
      ctx.beginPath(); ctx.arc(drawCX, drawCY, wrappingTarget ? 2.5 : 1.8, 0, 2 * Math.PI);
      ctx.fillStyle = C.foot; ctx.fill();
    }

    var tx2 = spider.thorax.pos.x + thoraxDX, ty2 = spider.thorax.pos.y + thoraxDY;
    ctx.beginPath(); ctx.arc(tx2, ty2, 4, 0, 2 * Math.PI); ctx.fillStyle = C.thorax; ctx.fill();
    var ax2 = spider.abdomen.pos.x + abdomenDX, ay2 = spider.abdomen.pos.y + abdomenDY;
    ctx.beginPath(); ctx.arc(ax2, ay2, 13.5, 0, 2 * Math.PI); ctx.fillStyle = C.abdomen; ctx.fill();
    ctx.beginPath(); ctx.arc(ax2, ay2 - 3, 4.5, 0, 2 * Math.PI); ctx.fillStyle = C.abdomenHL; ctx.fill();

    var ax = ax2, ay = ay2;
    var tx = tx2, ty = ty2;
    var fdx = tx - ax, fdy = ty - ay, fl = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    var fnx = fdx / fl, fny = fdy / fl, prx = -fny, pry = fnx;
    var eyeR = 5.4, ecx = ax + fnx * 10, ecy = ay + fny * 10, bs = blinkState.scale;

    function drawEye(ex, ey) {
      ctx.save(); ctx.translate(ex, ey); ctx.scale(1, bs);
      ctx.beginPath(); ctx.arc(0, 0, eyeR, 0, 2 * Math.PI); ctx.fillStyle = C.eyeWhite; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, eyeR * 0.35, 0, 2 * Math.PI); ctx.fillStyle = C.eyePupil; ctx.fill();
      ctx.restore();
    }
    drawEye(ecx + prx * 4, ecy + pry * 4);
    drawEye(ecx - prx * 4, ecy - pry * 4);
  };

  spider.drawParticles = function () { };
}
