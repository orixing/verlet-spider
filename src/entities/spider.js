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

  comp.thorax = new Particle(origin);
  comp.head = new Particle(origin.add(new Vec2(0, -6)));
  comp.abdomen = new Particle(origin.add(new Vec2(0, 12)));

  comp.particles.push(comp.thorax);
  comp.particles.push(comp.head);
  comp.particles.push(comp.abdomen);

  comp.constraints.push(new DistanceConstraint(comp.head, comp.thorax, 1));
  comp.constraints.push(new DistanceConstraint(comp.abdomen, comp.thorax, 1));
  comp.constraints.push(new AngleConstraint(comp.abdomen, comp.thorax, comp.head, 0.4));

  for (var i = 0; i < 2; ++i) {
    var yOff = (i - 0.5) * 5;

    comp.particles.push(new Particle(comp.particles[0].pos.add(new Vec2(3, yOff))));
    comp.particles.push(new Particle(comp.particles[0].pos.add(new Vec2(-3, yOff))));
    var len = comp.particles.length;

    comp.constraints.push(new DistanceConstraint(comp.particles[len - 2], comp.thorax, ls));
    comp.constraints.push(new DistanceConstraint(comp.particles[len - 1], comp.thorax, ls));

    var lc = (i === 0) ? 0.85 : 1.0;

    comp.particles.push(new Particle(comp.particles[len - 2].pos.add(
      (new Vec2(20, yOff * 15)).normal().mutableScale(5 * lc)
    )));
    comp.particles.push(new Particle(comp.particles[len - 1].pos.add(
      (new Vec2(-20, yOff * 15)).normal().mutableScale(5 * lc)
    )));
    len = comp.particles.length;

    comp.constraints.push(new DistanceConstraint(comp.particles[len - 4], comp.particles[len - 2], ls));
    comp.constraints.push(new DistanceConstraint(comp.particles[len - 3], comp.particles[len - 1], ls));

    comp.particles.push(new Particle(comp.particles[len - 2].pos.add(
      (new Vec2(20, yOff * 25)).normal().mutableScale(5 * lc)
    )));
    comp.particles.push(new Particle(comp.particles[len - 1].pos.add(
      (new Vec2(-20, yOff * 25)).normal().mutableScale(5 * lc)
    )));
    len = comp.particles.length;

    comp.constraints.push(new DistanceConstraint(comp.particles[len - 4], comp.particles[len - 2], ls));
    comp.constraints.push(new DistanceConstraint(comp.particles[len - 3], comp.particles[len - 1], ls));

    var rf = new Particle(comp.particles[len - 2].pos.add(
      (new Vec2(20, yOff * 50)).normal().mutableScale(3 * lc)
    ));
    var lf = new Particle(comp.particles[len - 1].pos.add(
      (new Vec2(-20, yOff * 50)).normal().mutableScale(3 * lc)
    ));
    comp.particles.push(rf);
    comp.particles.push(lf);
    comp.legs.push(rf);
    comp.legs.push(lf);
    len = comp.particles.length;

    comp.constraints.push(new DistanceConstraint(comp.particles[len - 4], comp.particles[len - 2], ls));
    comp.constraints.push(new DistanceConstraint(comp.particles[len - 3], comp.particles[len - 1], ls));

    var j1 = js * 1.4, j2 = js * 0.55, j3 = js * 1.1;

    comp.constraints.push(new AngleConstraint(comp.particles[len - 6], comp.particles[len - 4], comp.particles[len - 2], j3));
    comp.constraints.push(new AngleConstraint(comp.particles[len - 5], comp.particles[len - 3], comp.particles[len - 1], j3));
    comp.constraints.push(new AngleConstraint(comp.particles[len - 8], comp.particles[len - 6], comp.particles[len - 4], j2));
    comp.constraints.push(new AngleConstraint(comp.particles[len - 7], comp.particles[len - 5], comp.particles[len - 3], j2));
    comp.constraints.push(new AngleConstraint(comp.particles[0], comp.particles[len - 8], comp.particles[len - 6], j1));
    comp.constraints.push(new AngleConstraint(comp.particles[0], comp.particles[len - 7], comp.particles[len - 5], j1));
    comp.constraints.push(new AngleConstraint(comp.particles[1], comp.particles[0], comp.particles[len - 8], 1));
    comp.constraints.push(new AngleConstraint(comp.particles[1], comp.particles[0], comp.particles[len - 7], 1));
  }

  sim.composites.push(comp);
  return comp;
}
