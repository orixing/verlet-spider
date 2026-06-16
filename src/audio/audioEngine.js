/**
 * 音效引擎 — 全部用 Web Audio API 程序生成
 */

var AC = null;
var bgmGain = null, bgmStarted = false;
var bugBuzzNodes = {};
var _bgmNodes = [];
var MAX_BUG_BUZZ = 3;

function getAC() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  return AC;
}

function makeOscGain(type, freq, gainVal, dest) {
  var ctx = getAC();
  var osc = ctx.createOscillator();
  var g = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq || 440;
  g.gain.value = gainVal || 0.2;
  osc.connect(g);
  g.connect(dest || ctx.destination);
  return { osc: osc, gain: g, ctx: ctx };
}

function startBGM() {
  if (bgmStarted) return;
  bgmStarted = true;
  try {
    var ctx = getAC();
    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.0;
    bgmGain.connect(ctx.destination);
    bgmGain.gain.linearRampToValueAtTime(0.038, ctx.currentTime + 2.5);

    function addDrone(freq, vol) {
      var osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
      var lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.15;
      var lg = ctx.createGain(); lg.gain.value = 0.35;
      lfo.connect(lg); lg.connect(osc.frequency);
      var g = ctx.createGain(); g.gain.value = vol;
      osc.connect(g); g.connect(bgmGain);
      osc.start(); lfo.start();
      _bgmNodes.push(osc, lfo);
    }
    addDrone(130.8, 0.18);
    addDrone(196.0, 0.10);

    var melody = [523, 659, 784, 880, 1047, 784, 659];
    var melIdx = 0;
    function schedNote() {
      var delay = 0.55 + Math.random() * 0.35;
      var t = ctx.currentTime + delay;
      var f = melody[melIdx % melody.length];
      melIdx++;
      if (Math.random() < 0.22) { setTimeout(schedNote, delay * 1000); return; }
      var osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.055, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(g); g.connect(bgmGain);
      osc.start(t); osc.stop(t + 0.5);
      setTimeout(schedNote, delay * 1000);
    }
    schedNote();

    function schedBeat() {
      var delay = 1.6 + Math.random() * 0.4;
      var t = ctx.currentTime + delay;
      var beatBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
      var bd = beatBuf.getChannelData(0);
      for (var bi = 0; bi < bd.length; bi++) {
        var bt = bi / bd.length;
        bd[bi] = (Math.random() * 2 - 1) * Math.pow(1 - bt, 3) * 0.8;
      }
      var beatSrc = ctx.createBufferSource(); beatSrc.buffer = beatBuf;
      var beatLP = ctx.createBiquadFilter(); beatLP.type = 'lowpass'; beatLP.frequency.value = 250;
      var beatG = ctx.createGain(); beatG.gain.value = 0.08;
      beatSrc.connect(beatLP); beatLP.connect(beatG); beatG.connect(bgmGain);
      beatSrc.start(t);
      setTimeout(schedBeat, delay * 1000);
    }
    schedBeat();

    var bsz = Math.floor(ctx.sampleRate * 1.5);
    var nbuf = ctx.createBuffer(1, bsz, ctx.sampleRate);
    var nd = nbuf.getChannelData(0);
    for (var ni = 0; ni < bsz; ni++) nd[ni] = (Math.random() * 2 - 1);
    var nsrc = ctx.createBufferSource(); nsrc.buffer = nbuf; nsrc.loop = true;
    var nlp = ctx.createBiquadFilter(); nlp.type = 'lowpass'; nlp.frequency.value = 120;
    var ng = ctx.createGain(); ng.gain.value = 0.004;
    nsrc.connect(nlp); nlp.connect(ng); ng.connect(bgmGain);
    nsrc.start();
    _bgmNodes.push(nsrc);
  } catch (e) { }
}

function stopBGM() {
  if (bgmGain) bgmGain.gain.setTargetAtTime(0, getAC().currentTime, 0.8);
}

function playSfxFootstep() {
  try {
    var ctx = getAC();
    var buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3) * 0.6;
    }
    var src = ctx.createBufferSource(); src.buffer = buf;
    var g = ctx.createGain(); g.gain.value = 0.22;
    src.connect(g); g.connect(ctx.destination);
    src.start();
  } catch (e) { }
}

function playSfxLand(kind) {
  try {
    var ctx = getAC();
    var freq = kind === 'boulder' ? 160 : kind === 'bug' ? 280 : 120;
    var n = makeOscGain('sine', freq, 0.25);
    n.osc.frequency.exponentialRampToValueAtTime(freq * 0.4, ctx.currentTime + 0.18);
    n.gain.gain.setValueAtTime(0.25, ctx.currentTime);
    n.gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    n.osc.start(ctx.currentTime); n.osc.stop(ctx.currentTime + 0.22);
  } catch (e) { }
}

function playSfxEscape() {
  try {
    var ctx = getAC();
    var now = ctx.currentTime;
    var guzhengFreqs = [587, 659, 698, 784, 880];
    var base = guzhengFreqs[Math.floor(Math.random() * guzhengFreqs.length)];

    var harmonics = [1, 2, 3, 4, 6];
    var harmGains = [0.55, 0.30, 0.18, 0.10, 0.05];
    for (var hi = 0; hi < harmonics.length; hi++) {
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base * harmonics[hi];
      var g = ctx.createGain();
      g.gain.setValueAtTime(harmGains[hi], now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.10 + hi * 0.008);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.12 + hi * 0.01);
    }

    var clickLen = Math.floor(ctx.sampleRate * 0.006);
    var clickBuf = ctx.createBuffer(1, clickLen, ctx.sampleRate);
    var cd = clickBuf.getChannelData(0);
    for (var ci = 0; ci < clickLen; ci++) {
      cd[ci] = (Math.random() * 2 - 1) * Math.pow(1 - ci / clickLen, 3);
    }
    var clickSrc = ctx.createBufferSource(); clickSrc.buffer = clickBuf;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 3500; bp.Q.value = 0.8;
    var clickG = ctx.createGain(); clickG.gain.value = 0.45;
    clickSrc.connect(bp); bp.connect(clickG); clickG.connect(ctx.destination);
    clickSrc.start(now);

    var snapLen = Math.floor(ctx.sampleRate * 0.012);
    var snapBuf = ctx.createBuffer(1, snapLen, ctx.sampleRate);
    var sd = snapBuf.getChannelData(0);
    for (var si = 0; si < snapLen; si++) {
      sd[si] = (Math.random() * 2 - 1) * Math.exp(-si / snapLen * 15) * 0.8;
    }
    var snapSrc = ctx.createBufferSource(); snapSrc.buffer = snapBuf;
    var snapHP = ctx.createBiquadFilter(); snapHP.type = 'highpass'; snapHP.frequency.value = 3000;
    var snapG = ctx.createGain(); snapG.gain.value = 0.55;
    snapSrc.connect(snapHP); snapHP.connect(snapG); snapG.connect(ctx.destination);
    snapSrc.start(now + 0.002);
  } catch (e) { }
}

function startBugBuzz(oi) {
  if (bugBuzzNodes[oi]) return;
  if (Object.keys(bugBuzzNodes).length >= MAX_BUG_BUZZ) return;
  try {
    var ctx = getAC();
    var osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 180 + Math.random() * 40;
    var g = ctx.createGain(); g.gain.value = 0.008;
    var lfo = ctx.createOscillator();
    lfo.frequency.value = 24 + Math.random() * 8;
    var lfog = ctx.createGain(); lfog.gain.value = 22;
    lfo.connect(lfog); lfog.connect(osc.frequency);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(); lfo.start();
    bugBuzzNodes[oi] = { osc: osc, gain: g, lfo: lfo };
  } catch (e) { }
}

function stopBugBuzz(oi) {
  var n = bugBuzzNodes[oi];
  if (!n) return;
  try {
    n.gain.gain.setTargetAtTime(0, getAC().currentTime, 0.05);
    setTimeout(function () { try { n.osc.stop(); n.lfo.stop(); } catch (e) { } }, 200);
  } catch (e) { }
  delete bugBuzzNodes[oi];
}

function stopAllBugBuzz() {
  for (var k in bugBuzzNodes) stopBugBuzz(k);
}

function playSfxWrap(progress) {
  try {
    var ctx = getAC();
    var freq = 200 + progress * 300;
    var n = makeOscGain('triangle', freq, 0.08);
    n.osc.frequency.exponentialRampToValueAtTime(freq * 1.3, ctx.currentTime + 0.06);
    n.gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    n.osc.start(ctx.currentTime); n.osc.stop(ctx.currentTime + 0.07);
  } catch (e) { }
}

function playCollectSound(kind) {
  try {
    var ctx = getAC();
    var freq = kind === 'boulder' ? 520 : kind === 'bug' ? 720 : 440;
    var n = makeOscGain('sine', freq, 0.22);
    n.osc.frequency.exponentialRampToValueAtTime(freq * 1.7, ctx.currentTime + 0.1);
    n.gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    n.osc.start(ctx.currentTime); n.osc.stop(ctx.currentTime + 0.22);
    var n2 = makeOscGain('triangle', freq * 2, 0.08);
    n2.osc.frequency.exponentialRampToValueAtTime(freq * 3, ctx.currentTime + 0.12);
    n2.gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    n2.osc.start(ctx.currentTime); n2.osc.stop(ctx.currentTime + 0.15);
  } catch (e) { }
}

function playSfxSuccess() {
  try {
    var ctx = getAC();
    var notes = [523, 659, 784, 1047];
    notes.forEach(function (f, i) {
      var n = makeOscGain('sine', f, 0.25);
      var t = ctx.currentTime + i * 0.12;
      n.gain.gain.setValueAtTime(0, t);
      n.gain.gain.linearRampToValueAtTime(0.25, t + 0.05);
      n.gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      n.osc.start(t); n.osc.stop(t + 0.35);
    });
  } catch (e) { }
}

function playSfxGameOver() {
  try {
    var ctx = getAC();
    var n = makeOscGain('sawtooth', 220, 0.3);
    n.osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.8);
    n.gain.gain.setValueAtTime(0.3, ctx.currentTime);
    n.gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
    n.osc.start(ctx.currentTime); n.osc.stop(ctx.currentTime + 0.9);
    var buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / d.length * 6) * 0.5;
    var src = ctx.createBufferSource(); src.buffer = buf;
    var g = ctx.createGain(); g.gain.value = 0.35;
    src.connect(g); g.connect(ctx.destination); src.start();
  } catch (e) { }
}

/**
 * 统一导出音效引擎
 */
export var audioEngine = {
  startBGM: startBGM,
  stopBGM: stopBGM,
  playSfxFootstep: playSfxFootstep,
  playSfxLand: playSfxLand,
  playSfxEscape: playSfxEscape,
  startBugBuzz: startBugBuzz,
  stopBugBuzz: stopBugBuzz,
  stopAllBugBuzz: stopAllBugBuzz,
  playSfxWrap: playSfxWrap,
  playCollectSound: playCollectSound,
  playSfxSuccess: playSfxSuccess,
  playSfxGameOver: playSfxGameOver
};
