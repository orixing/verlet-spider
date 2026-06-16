/**
 * 关卡系统 — 波次节奏制
 *
 * 每关由多个波次组成，波次之间有间歇期。
 * 食物值：树叶(drop) = +1, 苍蝇(bug) = +5
 */

export var FOOD_VALUES = { bug: 5, drop: 1 };

/**
 * 生成一波投放：在 startFrame 起，密集投放多个物体
 * @param {number} startFrame - 起始帧
 * @param {Array} items - [{kind, delay}] delay 是相对 startFrame 的偏移帧数
 */
function wave(startFrame, items) {
  return items.map(function (item) {
    return { time: startFrame + (item.delay || 0), kind: item.kind };
  });
}

/** 快捷：一波苍蝇，间隔 gap 帧 */
function flyWave(start, count, gap) {
  var list = [];
  for (var i = 0; i < count; i++) list.push({ time: start + i * gap, kind: 'bug' });
  return list;
}

/** 快捷：一波树叶，间隔 gap 帧 */
function leafWave(start, count, gap) {
  var list = [];
  for (var i = 0; i < count; i++) list.push({ time: start + i * gap, kind: 'drop' });
  return list;
}

function merge() {
  var all = [];
  for (var i = 0; i < arguments.length; i++) all = all.concat(arguments[i]);
  all.sort(function (a, b) { return a.time - b.time; });
  return all;
}

/*
 * 波次设计原则：
 * - 每波 2-4 秒内密集出现（苍蝇间隔 60-90帧 ≈ 1-1.5秒）
 * - 波间间歇 8-15 秒，让玩家有时间处理
 * - 树叶穿插在间歇期或波次中
 * - 后期波次更密集、间歇更短
 *
 * 60帧 = 1秒
 */

export var LEVEL_CONFIGS = [
  /* ════════════════════════════════════════
     第1关：热身 — 3波，6只苍蝇，10片树叶
     ════════════════════════════════════════ */
  {
    foodGoal: 30,
    spawns: merge(
      /* 准备期：5秒安静 + 几片树叶飘落 */
      leafWave(180, 3, 90),               /* 3s起，3片树叶，间隔1.5s */

      /* 第1波 (10s)：2只苍蝇 */
      flyWave(600, 2, 90),                /* 10s起，2只苍蝇，间隔1.5s */
      leafWave(660, 2, 60),               /* 夹带2片树叶 */

      /* 间歇 12秒 */

      /* 第2波 (24s)：2只苍蝇 */
      flyWave(1440, 2, 75),               /* 24s起 */
      leafWave(1500, 2, 60),

      /* 间歇 10秒 */

      /* 第3波 (36s)：2只苍蝇 + 树叶 */
      flyWave(2160, 2, 60),               /* 36s起 */
      leafWave(2100, 3, 90)
    )
  },

  /* ════════════════════════════════════════
     第2关：节奏加快 — 4波，9只苍蝇，10片树叶
     ════════════════════════════════════════ */
  {
    foodGoal: 60,
    spawns: merge(
      /* 准备期 */
      leafWave(120, 2, 90),

      /* 第1波 (5s)：2只苍蝇 */
      flyWave(300, 2, 75),
      leafWave(360, 2, 60),

      /* 间歇 10秒 */

      /* 第2波 (17s)：3只苍蝇 */
      flyWave(1020, 3, 70),
      leafWave(1080, 2, 60),

      /* 间歇 10秒 */

      /* 第3波 (30s)：2只苍蝇 */
      flyWave(1800, 2, 60),
      leafWave(1860, 2, 75),

      /* 间歇 8秒 */

      /* 第4波 (40s)：2只苍蝇 + 树叶 */
      flyWave(2400, 2, 60),
      leafWave(2340, 2, 90)
    )
  },

  /* ════════════════════════════════════════
     第3关：压力渐增 — 5波，13只苍蝇，10片树叶
     ════════════════════════════════════════ */
  {
    foodGoal: 100,
    spawns: merge(
      leafWave(120, 2, 75),

      /* 第1波 (4s)：2只苍蝇 */
      flyWave(240, 2, 70),
      leafWave(300, 2, 60),

      /* 间歇 10秒 */

      /* 第2波 (16s)：3只苍蝇 */
      flyWave(960, 3, 65),
      leafWave(1020, 2, 60),

      /* 间歇 9秒 */

      /* 第3波 (28s)：3只苍蝇 */
      flyWave(1680, 3, 60),
      leafWave(1740, 1, 0),

      /* 间歇 8秒 */

      /* 第4波 (38s)：3只苍蝇 */
      flyWave(2280, 3, 55),
      leafWave(2340, 2, 60),

      /* 间歇 7秒 */

      /* 第5波 (47s)：2只苍蝇 */
      flyWave(2820, 2, 50),
      leafWave(2760, 1, 0)
    )
  },

  /* ════════════════════════════════════════
     第4关：全面提速 — 6波，17只苍蝇，10片树叶
     ════════════════════════════════════════ */
  {
    foodGoal: 150,
    spawns: merge(
      leafWave(90, 2, 60),

      /* 第1波 (3s)：3只苍蝇 */
      flyWave(180, 3, 65),
      leafWave(240, 1, 0),

      /* 间歇 9秒 */

      /* 第2波 (14s)：3只苍蝇 */
      flyWave(840, 3, 60),
      leafWave(900, 2, 60),

      /* 间歇 8秒 */

      /* 第3波 (24s)：3只苍蝇 */
      flyWave(1440, 3, 55),
      leafWave(1500, 1, 0),

      /* 间歇 7秒 */

      /* 第4波 (33s)：3只苍蝇 */
      flyWave(1980, 3, 50),
      leafWave(2040, 2, 60),

      /* 间歇 6秒 */

      /* 第5波 (41s)：3只苍蝇 */
      flyWave(2460, 3, 50),
      leafWave(2400, 1, 0),

      /* 间歇 5秒 */

      /* 第6波 (48s)：2只苍蝇 */
      flyWave(2880, 2, 45),
      leafWave(2940, 1, 0)
    )
  },

  /* ════════════════════════════════════════
     第5关：极限冲刺 — 7波，23只苍蝇，10片树叶
     ════════════════════════════════════════ */
  {
    foodGoal: 200,
    spawns: merge(
      leafWave(60, 2, 60),

      /* 第1波 (2s)：3只苍蝇 */
      flyWave(120, 3, 60),
      leafWave(180, 1, 0),

      /* 间歇 8秒 */

      /* 第2波 (12s)：3只苍蝇 */
      flyWave(720, 3, 55),
      leafWave(780, 2, 60),

      /* 间歇 7秒 */

      /* 第3波 (21s)：4只苍蝇 */
      flyWave(1260, 4, 50),
      leafWave(1320, 1, 0),

      /* 间歇 6秒 */

      /* 第4波 (29s)：3只苍蝇 */
      flyWave(1740, 3, 50),
      leafWave(1800, 2, 55),

      /* 间歇 6秒 */

      /* 第5波 (37s)：4只苍蝇 */
      flyWave(2220, 4, 45),
      leafWave(2280, 1, 0),

      /* 间歇 5秒 */

      /* 第6波 (44s)：3只苍蝇 */
      flyWave(2640, 3, 45),
      leafWave(2700, 1, 0),

      /* 间歇 4秒 */

      /* 第7波 (50s)：3只苍蝇 */
      flyWave(3000, 3, 40)
    )
  }
];

export var GAME_DURATION = 10800; /* 3分钟 */

/**
 * 根据难度等级缩放关卡参数
 */
export function getLevelCfg(n, difficultyLevel) {
  var base = LEVEL_CONFIGS[n];
  var d = difficultyLevel - 1;
  return {
    foodGoal: base.foodGoal + Math.floor(d * 20),
    spawns: base.spawns,
    flyReleaseScale: Math.pow(0.85, d),
    difficultyLevel: difficultyLevel
  };
}

/**
 * 格式化帧数为 m:ss
 */
export function framesToTime(f) {
  var s = Math.floor(f / 60);
  var m = Math.floor(s / 60);
  var ss = s % 60;
  return m + ':' + (ss < 10 ? '0' : '') + ss;
}
