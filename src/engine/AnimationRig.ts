import * as THREE from 'three';
import type { ModelKey } from '../assets/manifest';

export type RigMode = 'hangar' | 'combat' | 'closed' | 'opening' | 'open';

const Y_AXIS = new THREE.Vector3(0, 1, 0);

export interface RigControlInput {
  dt: number;
  elapsed: number;
  vx?: number;
  vy?: number;
  recoilImpulse?: number;
  playerPos?: THREE.Vector3;
  worldPos?: THREE.Vector3;
  disabledParts?: Set<string>;
}

export class AnimationRig {
  private readonly key: ModelKey;
  private readonly root: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private readonly nodes = new Map<string, THREE.Object3D>();
  private mode: RigMode;

  private morphLaunchElapsed = 0;
  private gateTriggered = false;
  private propGateDoorBone: THREE.Object3D | null = null;
  private propGateDoorAngleRad = 0;
  private bossFirePulse = 0;
  private carrierLaunchPulse = 0;
  private baseRotations = new Map<string, THREE.Euler>();
  private basePositions = new Map<string, THREE.Vector3>();

  constructor(
    key: ModelKey,
    root: THREE.Object3D,
    clips: THREE.AnimationClip[],
    initialMode: RigMode = 'combat'
  ) {
    this.key = key;
    this.root = root;
    this.mode = initialMode;
    this.mixer = new THREE.AnimationMixer(root);

    root.traverse((obj) => {
      if (obj.name && !this.nodes.has(obj.name)) {
        this.nodes.set(obj.name, obj);
        this.baseRotations.set(obj.name, obj.rotation.clone());
        this.basePositions.set(obj.name, obj.position.clone());
      }
      if (
        key === 'prop_gate' &&
        !this.propGateDoorBone &&
        (obj as THREE.Bone).isBone &&
        /door.*swing/i.test(obj.name)
      ) {
        this.propGateDoorBone = obj;
      }
    });

    for (const clip of clips) {
      const action = this.mixer.clipAction(clip);
      this.actions.set(clip.name, action);
    }

    this.applyMode(initialMode);
  }

  getMode(): RigMode {
    return this.mode;
  }

  getGateDoorAngleRad(): number {
    return this.propGateDoorAngleRad;
  }

  private syncPropGateWideDoorSwing(): void {
    const swingAction =
      this.actions.get('Vault | opening controls') ??
      Array.from(this.actions.values()).find((a) => a.getClip().tracks.length > 5) ??
      Array.from(this.actions.values())[0];

    const t = swingAction ? swingAction.time : 0;
    const s = THREE.MathUtils.clamp((t - 1.5) / 1.54, 0, 1);
    const eased = s * s * (3 - 2 * s);
    const angleRad = eased * THREE.MathUtils.degToRad(112);
    this.propGateDoorAngleRad = angleRad;
    if (this.propGateDoorBone) {
      this.propGateDoorBone.quaternion.setFromAxisAngle(Y_AXIS, angleRad);
    }
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
  }

  triggerBossFire(): void {
    this.bossFirePulse = 1.0;
  }

  triggerCarrierLaunch(): void {
    this.carrierLaunchPulse = 1.0;
  }

  setMode(mode: RigMode): void {
    if (this.mode === mode && mode !== 'opening') return;
    this.mode = mode;
    this.applyMode(mode);
  }

  private stopAllActions(): void {
    this.mixer.stopAllAction();
  }

  private applyMode(mode: RigMode): void {
    this.stopAllActions();

    if (this.key === 'ship_opus') {
      const rotorL = this.actions.get('Rotor_LAction');
      const rotorR = this.actions.get('Rotor_RAction');
      const canopy = this.actions.get('CanopyAction');
      const hatch = this.actions.get('RearHatchAction');
      const wingL = this.actions.get('Wing_LAction');
      const wingR = this.actions.get('Wing_RAction');
      const nacL = this.actions.get('Nacelle_LAction');
      const nacR = this.actions.get('Nacelle_RAction');

      if (rotorL) {
        rotorL.reset().setLoop(THREE.LoopRepeat, Infinity);
        rotorL.timeScale = 3.2;
        rotorL.play();
      }
      if (rotorR) {
        rotorR.reset().setLoop(THREE.LoopRepeat, Infinity);
        rotorR.timeScale = 3.2;
        rotorR.play();
      }

      if (mode === 'hangar') {
        for (const a of [canopy, hatch, wingL, wingR, nacL, nacR]) {
          if (!a) continue;
          a.reset().setLoop(THREE.LoopRepeat, Infinity);
          a.timeScale = 0.85;
          a.play();
        }
      } else {
        // Lock canopy & rear hatch tightly closed in space combat
        for (const a of [canopy, hatch]) {
          if (!a) continue;
          a.reset();
          a.timeScale = 1;
          a.paused = true;
          a.time = 0.042;
          a.play();
        }
        for (const a of [wingL, wingR, nacL, nacR]) {
          if (!a) continue;
          a.reset();
          a.timeScale = 1;
          a.paused = true;
          a.time = 0.15;
          a.play();
        }
      }
    } else if (this.key === 'ship_morph') {
      // Tandem supersonic interceptor with 9 clips:
      // canopy-open (0=closed -> dur=open), bay-open (0=closed -> dur=open),
      // gear-open (0=deployed down -> dur=retracted up inside hull),
      // aileron-roll / elevator-tilt / rudder-steer (0.5*dur=neutral, +/-0.25*dur=extremes).
      // Only bind the canonical forward clip per articulated subsystem so channels never fight.
      this.morphLaunchElapsed = 0;
      const canopy = this.actions.get('canopy-open');
      const bay = this.actions.get('bay-open');
      const gear = this.actions.get('gear-open');
      const aileron = this.actions.get('aileron-roll');
      const elevator = this.actions.get('elevator-tilt');
      const rudder = this.actions.get('rudder-steer');

      for (const a of [canopy, bay, gear]) {
        if (!a) continue;
        a.reset();
        a.timeScale = 1;
        a.paused = true;
        a.play();
      }

      const setMorphGearVisible = (visible: boolean) => {
        for (const gn of ['gear-main-right', 'gear-main-left', 'gear-nose']) {
          const gNode = this.nodes.get(gn);
          if (gNode) gNode.visible = visible;
        }
      };

      if (mode === 'hangar') {
        if (canopy) canopy.time = 0;
        if (bay) bay.time = 0;
        if (gear) gear.time = gear.getClip().duration * 0.42; // Tucked cleanly inside belly bay
        setMorphGearVisible(false);
        if (aileron) {
          aileron.reset().setLoop(THREE.LoopRepeat, Infinity);
          aileron.timeScale = 1.15;
          aileron.play();
        }
        if (elevator) {
          elevator.reset().setLoop(THREE.LoopRepeat, Infinity);
          elevator.timeScale = 0.95;
          elevator.play();
        }
        if (rudder) {
          rudder.reset().setLoop(THREE.LoopRepeat, Infinity);
          rudder.timeScale = 0.9;
          rudder.play();
        }
      } else {
        // Combat launch: seal canopy, retract landing gear & close bays cleanly during launch surge
        if (canopy) canopy.time = canopy.getClip().duration * 0.45;
        if (bay) bay.time = bay.getClip().duration * 0.65;
        if (gear) gear.time = gear.getClip().duration * 0.2;
        setMorphGearVisible(true);
        for (const a of [aileron, elevator, rudder]) {
          if (!a) continue;
          a.reset();
          a.timeScale = 1;
          a.paused = true;
          a.time = a.getClip().duration * 0.5;
          a.play();
        }
      }
    } else if (this.key === 'ship_aero') {
      for (const action of this.actions.values()) {
        if (mode === 'hangar') {
          action.reset().setLoop(THREE.LoopRepeat, Infinity);
          action.timeScale = 1.1;
          action.play();
        } else {
          action.reset();
          action.timeScale = 1;
          action.paused = true;
          action.time = action.getClip().duration * 0.5;
          action.play();
        }
      }
    } else if (this.key === 'ally_biplane') {
      for (const action of this.actions.values()) {
        action.reset().setLoop(THREE.LoopRepeat, Infinity);
        action.timeScale = 2.5;
        action.play();
      }
    } else if (this.key === 'enemy_drone') {
      for (const action of this.actions.values()) {
        action.reset().setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.timeScale = 1.6;
        action.play();
      }
    } else if (this.key === 'enemy_turret') {
      for (const action of this.actions.values()) {
        action.reset().setLoop(THREE.LoopRepeat, Infinity);
        action.timeScale = 1.45;
        action.play();
      }
    } else if (this.key === 'enemy_rover') {
      // Skip 'SAMPLE | animated canister' — animate only the 6 robotic arm joints rapidly
      for (const [name, action] of this.actions.entries()) {
        if (name.toLowerCase().includes('sample')) continue;
        action.reset().setLoop(THREE.LoopRepeat, Infinity);
        action.timeScale = 2.6;
        action.play();
      }
    } else if (this.key === 'enemy_foldwing') {
      // Verified keyframes: t=0.033s is spread flight state, t=5.033s is 80-deg folded state
      for (const action of this.actions.values()) {
        action.reset().setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.time = 5.0;
        action.timeScale = -2.4;
        action.play();
      }
    } else if (this.key === 'prop_gate') {
      if (mode === 'closed') {
        this.gateTriggered = false;
        for (const action of this.actions.values()) {
          action.reset();
          action.timeScale = 1;
          action.paused = true;
          action.time = 0.04;
          action.play();
        }
      } else if (mode === 'opening' || mode === 'open') {
        this.gateTriggered = true;
        for (const action of this.actions.values()) {
          action.reset().setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          if (mode === 'open') {
            action.timeScale = 1;
            action.time = Math.max(0.05, action.getClip().duration - 0.05);
            action.paused = true;
          } else {
            action.time = 0.04;
            action.timeScale = 2.15;
            action.paused = false;
          }
          action.play();
        }
      }
    }

    // Evaluate the initial mode pose immediately so frame 0 renders accurately
    this.mixer.update(0);
    if (this.key === 'prop_gate') {
      this.syncPropGateWideDoorSwing();
    }
  }

  update(input: RigControlInput): void {
    const safeDt = Number.isFinite(input.dt) && input.dt > 0 ? input.dt : 0;
    const { elapsed, vx = 0, vy = 0 } = input;
    this.bossFirePulse = Math.max(0, this.bossFirePulse - safeDt * 4.5);
    this.carrierLaunchPulse = Math.max(0, this.carrierLaunchPulse - safeDt * 1.4);

    if (this.key === 'ship_morph') {
      const canopy = this.actions.get('canopy-open');
      const bay = this.actions.get('bay-open');
      const gear = this.actions.get('gear-open');
      const aileron = this.actions.get('aileron-roll');
      const elevator = this.actions.get('elevator-tilt');
      const rudder = this.actions.get('rudder-steer');

      const setMorphGearVisible = (visible: boolean) => {
        for (const gn of ['gear-main-right', 'gear-main-left', 'gear-nose']) {
          const gNode = this.nodes.get(gn);
          if (gNode) gNode.visible = visible;
        }
      };

      if (this.mode === 'hangar') {
        // Coordinated 8.5s pre-flight inspection cycle: canopy opens, bays open before gear deploys,
        // then gear retracts cleanly inside belly bays without ever protruding above the upper wing skin.
        const phase = (elapsed % 8.5) / 8.5;
        const smooth = (t: number) => t * t * (3 - 2 * t);
        const ramp = (a: number, b: number, c: number, d: number): number => {
          if (phase < a || phase > d) return 0;
          if (phase < b) return smooth((phase - a) / Math.max(0.001, b - a));
          if (phase <= c) return 1;
          return smooth(1 - (phase - c) / Math.max(0.001, d - c));
        };
        const canopyOpenFrac = ramp(0.06, 0.28, 0.56, 0.78);
        const bayOpenFrac = ramp(0.14, 0.28, 0.72, 0.86);
        const gearDeployFrac = ramp(0.26, 0.44, 0.56, 0.72);

        if (canopy) canopy.time = canopy.getClip().duration * canopyOpenFrac;
        if (bay) bay.time = bay.getClip().duration * bayOpenFrac;
        // Clamp upward travel at 0.42*dur and hide inside belly bay once stowed so struts never poke through wings
        if (gear) gear.time = gear.getClip().duration * (0.42 * (1 - gearDeployFrac));
        setMorphGearVisible(gearDeployFrac > 0.08);
        this.mixer.update(safeDt);
      } else {
        // Combat mode: retract gear/bays/canopy smoothly during initial launch countdown, then stay sealed
        this.morphLaunchElapsed = Math.min(2.0, this.morphLaunchElapsed + safeDt);
        const sealT = THREE.MathUtils.clamp(this.morphLaunchElapsed / 0.85, 0, 1);
        const ease = 1 - Math.pow(1 - sealT, 3);
        const baySealT = THREE.MathUtils.clamp((this.morphLaunchElapsed - 0.35) / 0.65, 0, 1);
        const bayEase = 1 - Math.pow(1 - baySealT, 3);

        if (canopy) canopy.time = canopy.getClip().duration * 0.45 * (1 - ease);
        if (gear) gear.time = gear.getClip().duration * (0.15 + 0.27 * ease);
        setMorphGearVisible(sealT < 0.78);
        if (bay) bay.time = bay.getClip().duration * 0.65 * (1 - bayEase);

        const rollNorm = THREE.MathUtils.clamp(vx / 18, -1, 1);
        const pitchNorm = THREE.MathUtils.clamp(vy / 18, -1, 1);
        if (aileron) aileron.time = aileron.getClip().duration * (0.5 + rollNorm * 0.25);
        if (elevator) elevator.time = elevator.getClip().duration * (0.5 - pitchNorm * 0.25);
        if (rudder) rudder.time = rudder.getClip().duration * (0.5 + rollNorm * 0.25);
        this.mixer.update(0);
      }
    } else if (this.key === 'ship_opus' && this.mode === 'combat') {
      // Scrub Wing/Nacelle tilt slightly with strafe velocity while keeping Canopy & Hatch closed
      const bankNorm = THREE.MathUtils.clamp(Math.abs(vx) / 22, 0, 1);
      const nacTime = 0.1 + bankNorm * 0.55;
      for (const keyName of ['Wing_LAction', 'Wing_RAction', 'Nacelle_LAction', 'Nacelle_RAction']) {
        const a = this.actions.get(keyName);
        if (a) a.time = nacTime;
      }
      this.mixer.update(safeDt);
    } else if (this.key === 'ship_aero' && this.mode === 'combat') {
      const pitchNorm = THREE.MathUtils.clamp(vy / 18, -1, 1);
      const rollNorm = THREE.MathUtils.clamp(vx / 18, -1, 1);
      const elevL = this.actions.get('Elevator_L');
      const elevR = this.actions.get('Elevator_R');
      const ailL = this.actions.get('Aileron_L');
      const ailR = this.actions.get('Aileron_R');
      // Baked clips sweep +15deg (0.25*dur) -> neutral (0.5*dur) -> -15deg (0.75*dur);
      // Aileron_R is already authored opposing Aileron_L at identical timestamps.
      if (elevL) elevL.time = elevL.getClip().duration * (0.5 + pitchNorm * 0.25);
      if (elevR) elevR.time = elevR.getClip().duration * (0.5 + pitchNorm * 0.25);
      if (ailL) ailL.time = ailL.getClip().duration * (0.5 + rollNorm * 0.25);
      if (ailR) ailR.time = ailR.getClip().duration * (0.5 + rollNorm * 0.25);
      this.mixer.update(safeDt);
    } else if (this.key === 'prop_gate') {
      if (!this.gateTriggered && input.worldPos && input.worldPos.z >= -195) {
        this.setMode('opening');
      }
      this.mixer.update(safeDt);
      this.syncPropGateWideDoorSwing();
    } else {
      this.mixer.update(safeDt);
    }

    this.updateProceduralParts({ ...input, dt: safeDt });
  }

  private updateProceduralParts(input: RigControlInput): void {
    const { dt, elapsed, vx = 0, vy = 0, playerPos, worldPos, disabledParts } = input;

    if (this.key === 'ship_astra') {
      for (const rName of ['Rotor_FL', 'Rotor_FR', 'Rotor_RL', 'Rotor_RR']) {
        const n = this.nodes.get(rName);
        if (n) n.rotation.y += dt * 26;
      }
      const canopy = this.nodes.get('Cockpit_Canopy');
      const canopyBase = this.baseRotations.get('Cockpit_Canopy');
      if (canopy && canopyBase) {
        canopy.rotation.x =
          this.mode === 'hangar'
            ? canopyBase.x - (Math.sin(elapsed * 1.4) * 0.5 + 0.5) * 0.22
            : canopyBase.x;
      }
      for (const [skidName, dir] of [
        ['Landing_Skid_L', 1],
        ['Landing_Skid_R', -1],
      ] as const) {
        const skid = this.nodes.get(skidName);
        const basePos = this.basePositions.get(skidName);
        if (skid && basePos) {
          skid.position.y = this.mode === 'hangar' ? basePos.y : basePos.y + 0.22;
          skid.rotation.z = this.mode === 'hangar' ? 0 : dir * 0.35;
        }
      }
      const wingPitch = THREE.MathUtils.clamp(-vy * 0.015, -0.3, 0.3);
      const wingRoll = THREE.MathUtils.clamp(vx * 0.014, -0.28, 0.28);
      for (const wName of ['Front wing • port', 'Rear wing • port']) {
        const w = this.nodes.get(wName);
        if (w) w.rotation.x = wingPitch + wingRoll * 0.6;
      }
      for (const wName of ['Front wing • starboard', 'Rear wing • starboard']) {
        const w = this.nodes.get(wName);
        if (w) w.rotation.x = wingPitch - wingRoll * 0.6;
      }
      return;
    }

    if (this.key === 'ship_aero' || this.key === 'enemy_foldwing') {
      const prop = this.nodes.get('Propeller');
      if (prop) prop.rotation.z += dt * 36;
      return;
    }

    if (this.key === 'enemy_drone') {
      const turret = this.nodes.get('Turret | faceted multi-camera optical head');
      if (turret) {
        turret.rotation.y = Math.sin(elapsed * 3.1) * 0.55;
      }
      for (const [name, node] of this.nodes.entries()) {
        if (name.startsWith('Wheel |')) {
          node.rotation.x += dt * 11;
        }
      }
      return;
    }

    if (this.key === 'enemy_rover') {
      for (const [name, node] of this.nodes.entries()) {
        if (name.startsWith('07 |')) {
          node.rotation.x += dt * 9.5;
        }
      }
      return;
    }

    if (this.key === 'boss_act1_mech') {
      // 4 three-joint legs heavy stomping gait
      const legs = [
        ['Leg_FL_Upper', 'Leg_FL_Lower', 'Leg_FL_Foot', 0],
        ['Leg_FR_Upper', 'Leg_FR_Lower', 'Leg_FR_Foot', Math.PI],
        ['Leg_RL_Upper', 'Leg_RL_Lower', 'Leg_RL_Foot', Math.PI],
        ['Leg_RR_Upper', 'Leg_RR_Lower', 'Leg_RR_Foot', 0],
      ] as const;

      for (const [u, l, f, phase] of legs) {
        const s = Math.sin(elapsed * 2.8 + phase);
        const nu = this.nodes.get(u);
        const nl = this.nodes.get(l);
        const nf = this.nodes.get(f);
        if (nu) nu.rotation.x = s * 0.28;
        if (nl) nl.rotation.x = Math.max(0, -s) * 0.35;
        if (nf) nf.rotation.x = -s * 0.18;
      }

      // Turret tracking player
      const turret = this.nodes.get('Turret');
      if (turret && playerPos && worldPos) {
        const aimYaw = THREE.MathUtils.clamp(
          Math.atan2(playerPos.x - worldPos.x, Math.max(8, playerPos.z - worldPos.z)),
          -0.6,
          0.6
        );
        turret.rotation.y = THREE.MathUtils.lerp(turret.rotation.y, aimYaw, Math.min(1, dt * 5));
      }

      // Dual shoulder cannons recoil if not destroyed
      for (const [id, nodeName] of [
        ['cannon_l', 'Cannon_L'],
        ['cannon_r', 'Cannon_R'],
      ]) {
        if (disabledParts?.has(id)) continue;
        const n = this.nodes.get(nodeName);
        const basePos = this.basePositions.get(nodeName);
        if (n && basePos) {
          n.position.z = basePos.z - this.bossFirePulse * 0.18;
        }
      }
      return;
    }

    if (this.key === 'boss_act2_crab') {
      for (let i = 1; i <= 3; i++) {
        const legL = this.nodes.get(`Leg_L${i}`);
        const legR = this.nodes.get(`Leg_R${i}`);
        const ph = i * 1.1;
        if (legL) legL.rotation.z = Math.sin(elapsed * 4.5 + ph) * 0.24;
        if (legR) legR.rotation.z = -Math.sin(elapsed * 4.5 + ph + Math.PI * 0.5) * 0.24;
      }
      for (const [id, clawName, pincerName, sign] of [
        ['claw_l', 'Claw_L', 'Claw_L_Pincer', 1],
        ['claw_r', 'Claw_R', 'Claw_R_Pincer', -1],
      ] as const) {
        if (disabledParts?.has(id)) continue;
        const claw = this.nodes.get(clawName);
        const pincer = this.nodes.get(pincerName);
        if (claw) {
          claw.rotation.y = sign * (Math.sin(elapsed * 2.2) * 0.18 + this.bossFirePulse * 0.25);
        }
        if (pincer) {
          pincer.rotation.y = -sign * (0.2 + Math.sin(elapsed * 5.2) * 0.22);
        }
      }
      for (const eyeName of ['Eye_L', 'Eye_R']) {
        const eye = this.nodes.get(eyeName);
        if (eye && playerPos && worldPos) {
          eye.rotation.y = THREE.MathUtils.clamp((playerPos.x - worldPos.x) * 0.04, -0.4, 0.4);
        }
      }
      return;
    }

    if (this.key === 'boss_act3_carrier') {
      const dish = this.nodes.get('SensorMast_DishArray');
      if (dish) dish.rotation.y += dt * 2.4;

      if (!disabledParts?.has('dorsal_turret')) {
        const turret = this.nodes.get('DorsalTurret');
        if (turret) {
          const targetYaw =
            playerPos && worldPos
              ? THREE.MathUtils.clamp((playerPos.x - worldPos.x) * 0.035, -0.8, 0.8)
              : Math.sin(elapsed * 1.2) * 0.55;
          turret.rotation.y = THREE.MathUtils.lerp(turret.rotation.y, targetYaw, Math.min(1, dt * 4));
        }
      }

      if (!disabledParts?.has('bow_crane')) {
        const bow = this.nodes.get('BowCraneArms');
        if (bow) bow.rotation.x = Math.sin(elapsed * 1.8) * 0.14 + this.bossFirePulse * 0.18;
      }

      // Docked fighters subtly pulse forward when launching waves
      const launchZ = this.carrierLaunchPulse * 0.55;
      for (let i = 1; i <= 6; i++) {
        for (const side of ['Port', 'Stbd']) {
          const fn = `Fighter_${side}${i}`;
          const fNode = this.nodes.get(fn);
          const fBase = this.basePositions.get(fn);
          if (fNode && fBase) {
            const phaseOffset = Math.sin(elapsed * 3.5 + i) * 0.02;
            fNode.position.z = fBase.z + launchZ + phaseOffset;
          }
        }
      }
    }
  }
}
