/**
 * 关卡系统 — 时间轴脚本制
 *
 * 每关有 foodGoal 和 spawns 数组，精确定义每帧刷什么。
 * 食物值：树叶(drop) = +1, 苍蝇(bug) = +5
 */

export var FOOD_VALUES = { bug: 5, drop: 1 };

/**
 * 生成一批树叶 spawn 条目
 */
function leaves(startFrame, count, interval) {
  var list = [];
  for (var i = 0; i < count; i++) list.push({ time: startFrame + i * interval, kind: 'drop' });
  return list;
}

/**
 * 生成一批苍蝇 spawn 条目
 */
function flies(startFrame, count, interval) {
  var list = [];
  for (var i = 0; i < count; i++) list.push({ time: startFrame + i * interval, kind: 'bug' });
  return list;
}

function merge() {
  var all = [];
  for (var i = 0; i < arguments.length; i++) all = all.concat(arguments[i]);
  all.sort(function (a, b) { return a.time - b.time; });
  return all;
}

export var LEVEL_CONFIGS = [
  /* ── 第1关：热身 ── 苍蝇6只(间隔4-6s)，树叶10片 */
  {
    foodGoal: 30,
    spawns: merge(
      flies(120, 2, 360),           /* 2s起，每6s，2只 */
      flies(900, 2, 300),           /* 15s起，每5s，2只 */
      flies(1800, 2, 270),          /* 30s起，2只 */
      leaves(180, 4, 300),          /* 3s起，每5s，4片 */
      leaves(1500, 3, 270),         /* 25s起，3片 */
      leaves(2700, 3, 240)          /* 45s起，3片 */
    )
  },
  /* ── 第2关：节奏加快 ── 苍蝇9只，树叶10片 */
  {
    foodGoal: 60,
    spawns: merge(
      flies(90, 3, 330),            /* 1.5s起，每5.5s，3只 */
      flies(1080, 3, 300),          /* 18s起，每5s，3只 */
      flies(2100, 3, 270),          /* 35s起，3只 */
      leaves(120, 4, 280),
      leaves(1300, 3, 260),
      leaves(2400, 3, 240)
    )
  },
  /* ── 第3关：压力渐增 ── 苍蝇13只，树叶10片 */
  {
    foodGoal: 100,
    spawns: merge(
      flies(60, 4, 300),            /* 1s起，每5s，4只 */
      flies(1260, 4, 270),          /* 21s起，4只 */
      flies(2400, 5, 240),          /* 40s起，每4s，5只 */
      leaves(90, 4, 270),
      leaves(1200, 3, 250),
      leaves(2200, 3, 230)
    )
  },
  /* ── 第4关：全面提速 ── 苍蝇17只，树叶10片 */
  {
    foodGoal: 150,
    spawns: merge(
      flies(60, 5, 270),            /* 1s起，每4.5s，5只 */
      flies(1410, 6, 255),          /* 23.5s起，6只 */
      flies(2940, 6, 240),          /* 49s起，每4s，6只 */
      leaves(60, 4, 260),
      leaves(1200, 3, 240),
      leaves(2200, 3, 220)
    )
  },
  /* ── 第5关：极限冲刺 ── 苍蝇23只，树叶10片 */
  {
    foodGoal: 200,
    spawns: merge(
      flies(30, 7, 255),            /* 0.5s起，每4.25s，7只 */
      flies(1815, 8, 245),          /* 30s起，8只 */
      flies(3775, 8, 240),          /* 63s起，每4s，8只 */
      leaves(60, 4, 250),
      leaves(1200, 3, 230),
      leaves(2200, 3, 210)
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
  /* 难度提升：目标+20，苍蝇挣脱更快（由 main.js 处理） */
  return {
    foodGoal: base.foodGoal + Math.floor(d * 20),
    spawns: base.spawns,
    /* 苍蝇挣脱时间缩放 */
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
