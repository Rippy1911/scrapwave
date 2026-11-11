// A scene's cue list: [seconds, fn] pairs, each fired once, in order, as the scene clock passes it.
export function createTimeline(cues) {
  const list = cues.slice().sort((a, b) => a[0] - b[0]);
  let i = 0;
  return {
    run(t) { while (i < list.length && list[i][0] <= t) list[i++][1](t); },
    done: () => i >= list.length,
  };
}
