/**
 * 关卡系统 — 波次节奏制 + 新手引导关
 *
 * 第1关：tutorial（事件驱动，不使用 spawns 时间轴）
 * 第2~5关：波次时间轴驱动，铺满3分钟
 * 食物值：树叶(drop) = +1, 苍蝇(bug) = +5
 */

export var FOOD_VALUES = { bug: 5, drop: 1 };

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
 * 3分钟 = 10800帧, 60帧 = 1秒
 *
 * 设计原则：
 * - 波次均匀分布在 0~10800 帧
 * - 每波密集刷 2-4 只苍蝇（间隔 60-90帧）
 * - 波间间歇 15-25 秒，期间低频掉树叶（每 4-6 秒一片）
 * - 后期波间歇缩短、苍蝇增多
 */

export var LEVEL_CONFIGS = [
  /* ════════════════════════════════════════
     第1关：新手引导 — 事件驱动
     ════════════════════════════════════════ */
  {
    foodGoal: 15,
    tutorial: true,
    spawns: []
  },

  /* ════════════════════════════════════════
     第2关：热身 — foodGoal 35
     6波苍蝇 + 间歇树叶，铺满3分钟
     ════════════════════════════════════════ */
  {
    foodGoal: 35,
    spawns: merge(
      /* 间歇树叶：低频背景 */
      leafWave(120, 3, 300),              /* 2s起, 每5s, 3片 */

      /* 第1波 (10s) */
      flyWave(600, 2, 90),
      leafWave(780, 1, 0),

      /* 间歇树叶 */
      leafWave(1200, 2, 300),             /* 20s起 */

      /* 第2波 (30s) */
      flyWave(1800, 2, 90),
      leafWave(1980, 1, 0),

      /* 间歇树叶 */
      leafWave(2400, 2, 300),             /* 40s起 */

      /* 第3波 (50s) */
      flyWave(3000, 2, 80),
      leafWave(3180, 1, 0),

      /* 间歇树叶 */
      leafWave(3600, 2, 280),             /* 60s起 */

      /* 第4波 (70s) */
      flyWave(4200, 2, 80),
      leafWave(4380, 1, 0),

      /* 间歇树叶 */
      leafWave(4800, 2, 270),

      /* 第5波 (90s) */
      flyWave(5400, 2, 75),
      leafWave(5580, 2, 240),

      /* 间歇树叶 */
      leafWave(6300, 2, 260),

      /* 第6波 (115s) */
      flyWave(6900, 2, 75),
      leafWave(7080, 1, 0),

      /* 尾声树叶 */
      leafWave(7500, 3, 300),
      leafWave(8700, 3, 300),
      leafWave(9900, 2, 240)
    )
  },

  /* ════════════════════════════════════════
     第3关：节奏加快 — foodGoal 50
     8波苍蝇，间歇树叶
     ════════════════════════════════════════ */
  {
    foodGoal: 50,
    spawns: merge(
      leafWave(90, 2, 280),

      /* 第1波 (8s) */
      flyWave(480, 2, 80),
      leafWave(660, 1, 0),

      leafWave(1020, 2, 260),

      /* 第2波 (22s) */
      flyWave(1320, 2, 80),
      leafWave(1500, 1, 0),

      leafWave(1800, 2, 250),

      /* 第3波 (35s) */
      flyWave(2100, 3, 75),
      leafWave(2340, 1, 0),

      leafWave(2700, 2, 240),

      /* 第4波 (48s) */
      flyWave(2880, 2, 75),
      leafWave(3060, 1, 0),

      leafWave(3420, 2, 240),

      /* 第5波 (62s) */
      flyWave(3720, 3, 70),
      leafWave(3960, 1, 0),

      leafWave(4320, 2, 230),

      /* 第6波 (78s) */
      flyWave(4680, 2, 70),
      leafWave(4860, 1, 0),

      leafWave(5220, 2, 230),

      /* 第7波 (93s) */
      flyWave(5580, 3, 65),
      leafWave(5820, 1, 0),

      leafWave(6180, 2, 220),

      /* 第8波 (110s) */
      flyWave(6600, 2, 65),
      leafWave(6780, 1, 0),

      /* 尾声 */
      leafWave(7200, 3, 300),
      leafWave(8400, 3, 280),
      leafWave(9600, 2, 260)
    )
  },

  /* ════════════════════════════════════════
     第4关：压力渐增 — foodGoal 70
     10波苍蝇，间歇树叶
     ════════════════════════════════════════ */
  {
    foodGoal: 70,
    spawns: merge(
      leafWave(60, 2, 250),

      /* 第1波 (6s) */
      flyWave(360, 2, 75),
      leafWave(540, 1, 0),

      leafWave(840, 2, 240),

      /* 第2波 (18s) */
      flyWave(1080, 3, 70),
      leafWave(1320, 1, 0),

      leafWave(1620, 2, 230),

      /* 第3波 (30s) */
      flyWave(1800, 2, 70),
      leafWave(1980, 1, 0),

      leafWave(2280, 2, 220),

      /* 第4波 (42s) */
      flyWave(2520, 3, 65),
      leafWave(2760, 1, 0),

      leafWave(3060, 2, 210),

      /* 第5波 (55s) */
      flyWave(3300, 3, 65),
      leafWave(3540, 1, 0),

      leafWave(3840, 1, 0),

      /* 第6波 (67s) */
      flyWave(4020, 2, 60),
      leafWave(4200, 1, 0),

      leafWave(4500, 2, 200),

      /* 第7波 (78s) */
      flyWave(4680, 3, 60),
      leafWave(4920, 1, 0),

      leafWave(5220, 1, 0),

      /* 第8波 (90s) */
      flyWave(5400, 3, 55),
      leafWave(5640, 1, 0),

      leafWave(5940, 2, 200),

      /* 第9波 (103s) */
      flyWave(6180, 2, 55),
      leafWave(6360, 1, 0),

      leafWave(6660, 2, 200),

      /* 第10波 (115s) */
      flyWave(6900, 3, 55),
      leafWave(7140, 1, 0),

      /* 尾声 */
      leafWave(7500, 3, 300),
      leafWave(8700, 3, 280),
      leafWave(9900, 2, 250)
    )
  },

  /* ════════════════════════════════════════
     第5关：全面提速 — foodGoal 90
     12波苍蝇，间歇短，密度高
     ════════════════════════════════════════ */
  {
    foodGoal: 90,
    spawns: merge(
      leafWave(60, 2, 220),

      /* 第1波 (5s) */
      flyWave(300, 3, 70),
      leafWave(540, 1, 0),

      leafWave(780, 1, 0),

      /* 第2波 (15s) */
      flyWave(900, 3, 65),
      leafWave(1140, 1, 0),

      leafWave(1380, 2, 200),

      /* 第3波 (25s) */
      flyWave(1500, 3, 60),
      leafWave(1740, 1, 0),

      leafWave(1980, 1, 0),

      /* 第4波 (35s) */
      flyWave(2100, 3, 60),
      leafWave(2340, 1, 0),

      leafWave(2580, 2, 200),

      /* 第5波 (45s) */
      flyWave(2700, 3, 55),
      leafWave(2940, 1, 0),

      leafWave(3180, 1, 0),

      /* 第6波 (55s) */
      flyWave(3300, 2, 55),
      leafWave(3480, 1, 0),

      leafWave(3720, 2, 200),

      /* 第7波 (65s) */
      flyWave(3900, 3, 50),
      leafWave(4140, 1, 0),

      leafWave(4380, 1, 0),

      /* 第8波 (75s) */
      flyWave(4500, 3, 50),
      leafWave(4740, 1, 0),

      leafWave(4980, 2, 190),

      /* 第9波 (85s) */
      flyWave(5100, 3, 50),
      leafWave(5340, 1, 0),

      leafWave(5580, 1, 0),

      /* 第10波 (95s) */
      flyWave(5700, 3, 45),
      leafWave(5940, 1, 0),

      leafWave(6180, 2, 190),

      /* 第11波 (106s) */
      flyWave(6360, 3, 45),
      leafWave(6600, 1, 0),

      leafWave(6840, 1, 0),

      /* 第12波 (117s) */
      flyWave(7020, 3, 45),
      leafWave(7260, 1, 0),

      /* 尾声 */
      leafWave(7500, 3, 280),
      leafWave(8400, 3, 260),
      leafWave(9600, 3, 240)
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
    foodGoal: base.foodGoal + (base.tutorial ? 0 : Math.floor(d * 20)),
    spawns: base.spawns,
    tutorial: !!base.tutorial,
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
