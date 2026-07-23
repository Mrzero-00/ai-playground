const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class Hud {
  constructor(root) {
    root.innerHTML = `
      <section class="topbar">
        <div>
          <p class="eyebrow">ALPINE MERCENARIES</p>
          <h1 id="location">백은 용병 사무실</h1>
        </div>
        <div class="objective" id="objective">의뢰판에서 첫 의뢰를 확인하십시오.</div>
      </section>

      <section class="boss-panel is-hidden" id="boss-panel">
        <div class="boss-copy"><strong id="boss-name">서리뿔 와이번</strong><span id="boss-state">경계 중</span></div>
        <div class="bar boss"><i id="boss-health"></i></div>
      </section>

      <section class="status-panel">
        <div class="portrait"><span>AM</span></div>
        <div class="status-copy">
          <div class="status-label"><strong>이름 없는 용병</strong><span id="weapon">검과 방패</span></div>
          <div class="bar health"><i id="health"></i><b id="health-text">100 / 100</b></div>
          <div class="bar stamina"><i id="stamina"></i></div>
        </div>
      </section>

      <section class="ally-panel is-hidden" id="ally-panel">
        <p>훈련 동료</p>
        <div id="ally-list"></div>
      </section>

      <section class="weapon-panel">
        <button class="slot is-active" id="slot-shield"><kbd>1</kbd><span>검과 방패</span></button>
        <button class="slot" id="slot-bow"><kbd>2</kbd><span>장궁</span></button>
      </section>

      <div class="prompt is-hidden" id="prompt"></div>
      <div class="toast is-hidden" id="toast"></div>
      <div class="crosshair" id="crosshair"><i></i></div>

      <details class="controls">
        <summary>조작 보기</summary>
        <p><kbd>WASD</kbd> 이동 · <kbd>Shift</kbd> 질주 · <kbd>Ctrl</kbd> 앉기 · <kbd>Space</kbd> 점프/넘기</p>
        <p><kbd>우클릭</kbd> 방어/정밀조준 · <kbd>좌클릭</kbd> 공격 · <kbd>F</kbd> 완벽 쳐내기</p>
      </details>
    `;

    this.location = root.querySelector("#location");
    this.objective = root.querySelector("#objective");
    this.weapon = root.querySelector("#weapon");
    this.health = root.querySelector("#health");
    this.healthText = root.querySelector("#health-text");
    this.stamina = root.querySelector("#stamina");
    this.bossPanel = root.querySelector("#boss-panel");
    this.bossHealth = root.querySelector("#boss-health");
    this.bossState = root.querySelector("#boss-state");
    this.allyPanel = root.querySelector("#ally-panel");
    this.allyList = root.querySelector("#ally-list");
    this.prompt = root.querySelector("#prompt");
    this.toast = root.querySelector("#toast");
    this.crosshair = root.querySelector("#crosshair");
    this.shieldSlot = root.querySelector("#slot-shield");
    this.bowSlot = root.querySelector("#slot-bow");
    this.toastTimer = 0;
  }

  setScene(mode) {
    const mission = mode === "mission";
    this.location.textContent = mission ? "서리 수도원 · 북쪽 회랑" : "백은 용병 사무실";
    this.objective.textContent = mission
      ? "서리뿔 와이번을 처치하고 동료를 보호하십시오."
      : "의뢰판에서 첫 의뢰를 확인하십시오.";
    this.bossPanel.classList.toggle("is-hidden", !mission);
    this.allyPanel.classList.toggle("is-hidden", !mission);
  }

  setWeapon(weapon) {
    const bow = weapon === "bow";
    this.weapon.textContent = bow ? "장궁 · 후위 정밀 공격" : "검과 방패 · 전위 보호";
    this.shieldSlot.classList.toggle("is-active", !bow);
    this.bowSlot.classList.toggle("is-active", bow);
  }

  setPrompt(message) {
    this.prompt.textContent = message || "";
    this.prompt.classList.toggle("is-hidden", !message);
  }

  setAimPointer(x, y) {
    this.crosshair.style.left = `${((x + 1) * 0.5) * 100}%`;
    this.crosshair.style.top = `${((1 - y) * 0.5) * 100}%`;
  }

  showToast(message, seconds = 2.4) {
    this.toast.textContent = message;
    this.toast.classList.remove("is-hidden");
    this.toastTimer = seconds;
  }

  update(dt, player, boss, allies, bossLabel) {
    const healthRatio = clamp(player.health / player.maxHealth, 0, 1);
    const staminaRatio = clamp(player.stamina / player.maxStamina, 0, 1);
    this.health.style.width = `${healthRatio * 100}%`;
    this.healthText.textContent = `${Math.ceil(player.health)} / ${player.maxHealth}`;
    this.stamina.style.width = `${staminaRatio * 100}%`;
    this.crosshair.classList.toggle("is-aiming", player.weapon === "bow" && player.aiming);

    if (boss) {
      this.bossHealth.style.width = `${clamp(boss.health / boss.maxHealth, 0, 1) * 100}%`;
      this.bossState.textContent = bossLabel;
      this.allyList.innerHTML = allies
        .map((ally) => `<div><span>${ally.name}</span><i style="width:${clamp(ally.health, 0, 100)}%"></i></div>`)
        .join("");
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.classList.add("is-hidden");
    }
  }
}
