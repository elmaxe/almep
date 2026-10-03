const STICK_R = 52; // px the knob can travel from the stick centre
const LOOK_SPEED = 0.0048; // radians per px dragged
const RUN_AT = 0.92; // stick pushed this far = run

/**
 * On-screen controls for phones and tablets: a floating stick on the left
 * third of the screen to walk, drag anywhere else to look, and buttons for
 * jump, crouch and pause.
 */
export class TouchControls {
  constructor(player, { onPause }) {
    this.player = player;
    this.root = document.getElementById('touch');
    this.stick = document.getElementById('stick');
    this.knob = document.getElementById('knob');
    this.crouchBtn = document.getElementById('btn-crouch');
    this.move = null; // { id, x0, y0 }
    this.look = null; // { id, x, y }

    this.root.addEventListener('pointerdown', (e) => this.down(e));
    this.root.addEventListener('pointermove', (e) => this.drag(e));
    this.root.addEventListener('pointerup', (e) => this.up(e));
    this.root.addEventListener('pointercancel', (e) => this.up(e));

    const press = (id, fn) => {
      document.getElementById(id).addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fn();
      });
    };
    press('btn-jump', () => player.jump());
    press('btn-crouch', () => this.setCrouch(!player.touch.crouch));
    document.getElementById('btn-pause').addEventListener('click', () => onPause());
    // stop long-presses from opening the context menu / text selection
    document.addEventListener('contextmenu', (e) => {
      if (document.body.classList.contains('touch')) e.preventDefault();
    });
  }

  setCrouch(on) {
    this.player.touch.crouch = on;
    this.crouchBtn.classList.toggle('on', on);
  }

  down(e) {
    e.preventDefault();
    this.root.setPointerCapture?.(e.pointerId);
    if (!this.move && e.clientX < window.innerWidth * 0.4) {
      this.move = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
      this.stick.style.left = `${e.clientX}px`;
      this.stick.style.top = `${e.clientY}px`;
      this.stick.style.bottom = 'auto';
      this.stick.classList.add('active');
      this.setKnob(0, 0);
    } else if (!this.look) {
      this.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
  }

  drag(e) {
    if (this.move && e.pointerId === this.move.id) {
      let dx = e.clientX - this.move.x0;
      let dy = e.clientY - this.move.y0;
      const d = Math.hypot(dx, dy);
      if (d > STICK_R) {
        dx *= STICK_R / d;
        dy *= STICK_R / d;
      }
      this.setKnob(dx, dy);
    } else if (this.look && e.pointerId === this.look.id) {
      this.player.look(e.clientX - this.look.x, e.clientY - this.look.y, LOOK_SPEED);
      this.look.x = e.clientX;
      this.look.y = e.clientY;
    }
  }

  up(e) {
    if (this.move && e.pointerId === this.move.id) {
      this.move = null;
      this.setKnob(0, 0);
      this.stick.classList.remove('active');
      this.stick.style.left = this.stick.style.top = this.stick.style.bottom = '';
    } else if (this.look && e.pointerId === this.look.id) {
      this.look = null;
    }
  }

  setKnob(dx, dy) {
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    let x = dx / STICK_R, y = dy / STICK_R;
    const m = Math.hypot(x, y);
    if (m < 0.12) x = y = 0; // dead zone
    const t = this.player.touch;
    t.x = x;
    t.y = y;
    t.run = m > RUN_AT;
    this.stick.classList.toggle('run', t.run);
  }

  /** Drop any in-progress touches, e.g. when the game is paused. */
  reset() {
    if (this.move) this.up({ pointerId: this.move.id });
    this.look = null;
    this.setCrouch(false);
  }
}
