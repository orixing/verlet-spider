import { DistanceConstraint } from '../engine/constraints.js';

/**
 * 设置蜘蛛的自定义绘制函数
 */
export function setupSpiderDraw(spider, legConstraintCount, footState, blinkState, getWrappingTarget) {
  spider.drawConstraints = function (ctx, comp) {
    var wrappingTarget = getWrappingTarget();

    for (var i = 3; i < legConstraintCount; ++i) {
      var con = comp.constraints[i];
      if (!(con instanceof DistanceConstraint)) continue;
      ctx.beginPath(); ctx.moveTo(con.a.pos.x, con.a.pos.y); ctx.lineTo(con.b.pos.x, con.b.pos.y);
      var s = 9, ip = (i - 3) % s;
      if (ip <= 1) { ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 6; }
      else if (ip <= 3) { ctx.strokeStyle = "#222"; ctx.lineWidth = 4; }
      else if (ip <= 5) { ctx.strokeStyle = "#2a2a2a"; ctx.lineWidth = 3; }
      else { ctx.strokeStyle = "#333"; ctx.lineWidth = 2; }
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
      ctx.strokeStyle = wrappingTarget ? "#2a2a2a" : "#333";
      ctx.lineWidth = wrappingTarget ? 2.5 : 2;
      ctx.stroke();
      ctx.beginPath(); ctx.arc(drawCX, drawCY, wrappingTarget ? 2.5 : 1.8, 0, 2 * Math.PI);
      ctx.fillStyle = "#111"; ctx.fill();
    }

    var tx2 = spider.thorax.pos.x + thoraxDX, ty2 = spider.thorax.pos.y + thoraxDY;
    ctx.beginPath(); ctx.arc(tx2, ty2, 4, 0, 2 * Math.PI); ctx.fillStyle = "#1a1a1a"; ctx.fill();
    var ax2 = spider.abdomen.pos.x + abdomenDX, ay2 = spider.abdomen.pos.y + abdomenDY;
    ctx.beginPath(); ctx.arc(ax2, ay2, 13.5, 0, 2 * Math.PI); ctx.fillStyle = "#1a1a1a"; ctx.fill();
    ctx.beginPath(); ctx.arc(ax2, ay2 - 3, 4.5, 0, 2 * Math.PI); ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fill();

    var ax = ax2, ay = ay2;
    var tx = tx2, ty = ty2;
    var fdx = tx - ax, fdy = ty - ay, fl = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    var fnx = fdx / fl, fny = fdy / fl, prx = -fny, pry = fnx;
    var eyeR = 5.4, ecx = ax + fnx * 10, ecy = ay + fny * 10, bs = blinkState.scale;

    function drawEye(ex, ey) {
      ctx.save(); ctx.translate(ex, ey); ctx.scale(1, bs);
      ctx.beginPath(); ctx.arc(0, 0, eyeR, 0, 2 * Math.PI); ctx.fillStyle = "#f0f0c0"; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, eyeR * 0.35, 0, 2 * Math.PI); ctx.fillStyle = "#222"; ctx.fill();
      ctx.restore();
    }
    drawEye(ecx + prx * 4, ecy + pry * 4);
    drawEye(ecx - prx * 4, ecy - pry * 4);
  };

  spider.drawParticles = function () { };
}
