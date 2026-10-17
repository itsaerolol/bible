// Shared motion helpers. Injected into every component at build time.
// Rules: ease in and out only. Nothing bounces or wobbles. Values come from tokens.json.
function hfEnter(tl, el, kind, at, T, delay) {
  var e = T.motion.entrances[kind];
  if (!e) throw new Error("unknown entrance: " + kind);
  var from = { opacity: 0, y: e.y };
  var to = { opacity: 1, y: 0, duration: e.duration, ease: T.motion.ease.out };
  if (e.blur) {
    from.filter = "blur(" + e.blur + "px)";
    to.filter = "blur(0px)";
  }
  tl.fromTo(el, from, to, at + (delay || 0));
}
function hfExit(tl, el, at, T) {
  tl.to(el, { opacity: 0, duration: T.motion.exitSeconds, ease: T.motion.ease.in }, at);
}
