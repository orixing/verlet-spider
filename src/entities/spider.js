import { Vec2 } from '../engine/Vec2.js';
import { Particle } from '../engine/Particle.js';
import { DistanceConstraint, AngleConstraint } from '../engine/constraints.js';
import { Composite } from '../engine/Composite.js';

/**
 * 生成蜘蛛复合体（4腿）
 * @param {VerletJS} sim - 物理引擎实例
 * @param {Vec2} origin - 初始位置
 * @param {Object} P - 参数 {legStiff, jointStiff}
 * @returns {Composite}
 */
export function createSpider(sim, origin, P) {
  P = P || {};
  var ls = P.legStiff != null ? P.legStiff : 0.3;
  var js = P.jointStiff != null ? P.jointStiff : 0.35;

  var comp = new Composite();
  comp.legs = [];
  comp.legChains = [];

  comp.thorax = new Particle(origin);
  comp.head = new Particle(origin.add(new Vec2(0, -6)));
  comp.abdomen = new Particle(origin.add(new Vec2(0, 12)));

  comp.particles.push(comp.thorax);
  comp.particles.push(comp.head);
  comp.particles.push(comp.abdomen);

  comp.constraints.push(new DistanceConstraint(comp.head, comp.thorax, 1));
  comp.constraints.push(new DistanceConstraint(comp.abdomen, comp.thorax, 1));
  comp.constraints.push(new AngleConstraint(comp.abdomen, comp.thorax, comp.head, 0.4));

  function addLeg(side, yOff, lc) {
    var p1 = new Particle(comp.thorax.pos.add(new Vec2(side * 4, yOff)));
    var p2 = new Particle(p1.pos.add((new Vec2(side * 20, yOff * 15)).normal().mutableScale(4.4 * lc)));
    var p3 = new Particle(p2.pos.add((new Vec2(side * 20, yOff * 24)).normal().mutableScale(4.6 * lc)));
    var p4 = new Particle(p3.pos.add((new Vec2(side * 20, yOff * 36)).normal().mutableScale(4.2 * lc)));
    var foot = new Particle(p4.pos.add((new Vec2(side * 20, yOff * 52)).normal().mutableScale(3.1 * lc)));

    comp.particles.push(p1, p2, p3, p4, foot);
    comp.legs.push(foot);
    comp.legChains.push([comp.thorax, p1, p2, p3, p4, foot]);

    comp.constraints.push(new DistanceConstraint(comp.thorax, p1, ls));
    comp.constraints.push(new DistanceConstraint(p1, p2, ls));
    comp.constraints.push(new DistanceConstraint(p2, p3, ls));
    comp.constraints.push(new DistanceConstraint(p3, p4, ls));
    comp.constraints.push(new DistanceConstraint(p4, foot, ls));

    var jBase = js * 1.15;
    var jMid = js * 0.9;
    var jTip = js * 0.75;
    comp.constraints.push(new AngleConstraint(comp.thorax, p1, p2, jBase));
    comp.constraints.push(new AngleConstraint(p1, p2, p3, jMid));
    comp.constraints.push(new AngleConstraint(p2, p3, p4, jMid));
    comp.constraints.push(new AngleConstraint(p3, p4, foot, jTip));
    comp.constraints.push(new AngleConstraint(comp.head, comp.thorax, p1, 1));
  }

  for (var i = 0; i < 2; ++i) {
    var yOff = (i - 0.5) * 5;
    var lc = (i === 0) ? 0.85 : 1.0;
    addLeg(1, yOff, lc);
    addLeg(-1, yOff, lc);
  }

  sim.composites.push(comp);
  return comp;
}
