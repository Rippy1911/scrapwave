// window.scrapwake.touch: drive the touch controls from tests.
//   enabled()             touch controls on?
//   state()               mode, stick, held buttons and the merged outputs
//   press(action, ms)     press a button; released after ms (default 200, 0 = hold until release(action))
//   release(action)       release a held button
//   stick(x, y)           left stick, -1..1 (y + = forward); stick(0, 0) centres it
//   look(dx, dy)          a swipe on the right side, in pixels
//   set(on)               force the touch controls on / off (null = automatic again)
import { ACTIONS } from "@/game/ui/touch/state";

export function touchHooks(game) {
  const tc = () => game.touch;
  return {
    touch: {
      enabled: () => tc().enabled(),
      actions: () => [...ACTIONS],
      state() {
        const t = tc().state;
        return {
          enabled: tc().enabled(), mode: tc().mode(), stick: { x: t.stickX, y: t.stickY }, held: [...t.held],
          out: { steer: t.steer, throttle: t.throttle, brake: t.brake, handbrake: t.handbrake, turbo: t.turbo, fire: t.fire, rockets: t.rockets, pitch: t.pitch, roll: t.roll },
          keys: [...t.keys], aim: game.playerAim.mode(),
        };
      },
      press(action, ms = 200) {
        if (!tc().press(action)) return false;
        if (ms > 0) setTimeout(() => tc().release(action), ms);
        return true;
      },
      release(action) { tc().release(action); return true; },
      stick(x = 0, y = 0) { tc().stick(x, y); return true; },
      look(dx = 0, dy = 0) { tc().look(dx, dy); return true; },
      set(on) { return on === null || on === undefined ? tc().refresh() : tc().setEnabled(on); },
    },
  };
}