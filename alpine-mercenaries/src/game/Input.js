export class Input {
  constructor(element) {
    this.element = element;
    this.keys = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.pointer = { x: 0, y: 0 };
    this.lookDelta = { x: 0, y: 0 };
    this.mouse = { left: false, right: false, leftPressed: false, rightPressed: false };

    window.addEventListener("keydown", (event) => {
      if (!this.keys.has(event.code)) this.pressed.add(event.code);
      this.keys.add(event.code);
      if (["Space", "KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
        event.preventDefault();
      }
    });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
      this.released.add(event.code);
    });

    window.addEventListener("blur", () => {
      this.keys.clear();
      this.mouse.left = false;
      this.mouse.right = false;
    });

    element.addEventListener("pointermove", (event) => {
      if (document.pointerLockElement === element) return;
      const rect = element.getBoundingClientRect();
      this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    });

    element.addEventListener("pointerdown", (event) => {
      if (document.pointerLockElement !== element && event.button === 0) {
        const lockRequest = element.requestPointerLock?.();
        if (lockRequest?.catch) lockRequest.catch(() => {});
        return;
      }
      if (event.button === 0) {
        this.mouse.left = true;
        this.mouse.leftPressed = true;
      }
      if (event.button === 2) {
        this.mouse.right = true;
        this.mouse.rightPressed = true;
      }
    });

    window.addEventListener("pointerup", (event) => {
      if (event.button === 0) this.mouse.left = false;
      if (event.button === 2) this.mouse.right = false;
    });

    element.addEventListener("contextmenu", (event) => event.preventDefault());

    document.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement !== element) return;
      this.lookDelta.x += event.movementX;
      this.lookDelta.y += event.movementY;
    });
  }

  isDown(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouse.leftPressed = false;
    this.mouse.rightPressed = false;
    this.lookDelta.x = 0;
    this.lookDelta.y = 0;
  }
}
