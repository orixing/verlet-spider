import { DistanceConstraint } from '../engine/constraints.js';
import popoHeadUrl from '../assets/popo.png';

var popoHeadImg = new Image();
popoHeadImg.src = popoHeadUrl;

/**
 * 设置蜘蛛的自定义绘制函数
 */
export function setupSpiderDraw(spider, legConstraintCount, footState, blinkState, getWrappingTarget) {
  spider.drawConstraints = function (ctx, comp) {
    var wrappingTarget = getWrappingTarget();

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

    var footDraw = [];
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
        ctx.strokeStyle = 'rgba(80,80,80,0.18)'; ctx.lineWidth = 1.2; ctx.stroke();
      }
      footDraw.push({ x: drawCX, y: drawCY });
    }

    var tx2 = spider.thorax.pos.x + thoraxDX, ty2 = spider.thorax.pos.y + thoraxDY;
    var ax2 = spider.abdomen.pos.x + abdomenDX, ay2 = spider.abdomen.pos.y + abdomenDY;

    // Soft curved legs with more joints.
    var chains = spider.legChains || [];
    for (var ci = 0; ci < chains.length; ci++) {
      var chain = chains[ci];
      var pts = [];
      for (var pi = 0; pi < chain.length; pi++) {
        var p = chain[pi].pos;
        pts.push({ x: p.x, y: p.y });
      }
      if (footDraw[ci]) {
        pts[pts.length - 1] = footDraw[ci];
      }

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var qi = 1; qi < pts.length - 2; qi++) {
        var xc = (pts[qi].x + pts[qi + 1].x) * 0.5;
        var yc = (pts[qi].y + pts[qi + 1].y) * 0.5;
        ctx.quadraticCurveTo(pts[qi].x, pts[qi].y, xc, yc);
      }
      ctx.quadraticCurveTo(
        pts[pts.length - 2].x,
        pts[pts.length - 2].y,
        pts[pts.length - 1].x,
        pts[pts.length - 1].y
      );
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0c0c0c';
      ctx.lineWidth = 4.6;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var qi2 = 1; qi2 < pts.length - 2; qi2++) {
        var xc2 = (pts[qi2].x + pts[qi2 + 1].x) * 0.5;
        var yc2 = (pts[qi2].y + pts[qi2 + 1].y) * 0.5;
        ctx.quadraticCurveTo(pts[qi2].x, pts[qi2].y, xc2, yc2);
      }
      ctx.quadraticCurveTo(
        pts[pts.length - 2].x,
        pts[pts.length - 2].y,
        pts[pts.length - 1].x,
        pts[pts.length - 1].y
      );
      ctx.strokeStyle = '#1b1b1b';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    var ax = ax2, ay = ay2;
    var tx = tx2, ty = ty2;
    var fdx = tx - ax, fdy = ty - ay, fl = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    var fnx = fdx / fl, fny = fdy / fl, prx = -fny, pry = fnx;

    // Replace old spider body with provided image head while keeping size similar.
    if (popoHeadImg.complete && popoHeadImg.naturalWidth > 0) {
      var imgW = 32;
      var imgH = imgW * (popoHeadImg.naturalHeight / popoHeadImg.naturalWidth);
      var imgCX = ax + fnx * 4;
      var imgCY = ay + fny * 4;
      ctx.drawImage(popoHeadImg, imgCX - imgW * 0.5, imgCY - imgH * 0.5, imgW, imgH);
    }
  };

  spider.drawParticles = function () { };
}
