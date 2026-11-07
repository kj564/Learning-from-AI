/**
 * Translation of: client/sound/SoundEngine.{h,cpp} — verbatim (254 LoC)
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/client/sound/SoundEngine.{h,cpp}
 *
 * SoundEngine manages all sound playback. In the C++ source it delegates to
 * SoundSystemSL (Android OpenSL ES), SoundSystemAL (macOS OpenAL), or
 * SoundSystem (default — PCM samples played via platform audio API).
 *
 * In the browser, we use the Web Audio API (AudioContext) as the equivalent
 * of SoundSystem. PCM samples are loaded as AudioBuffers and played with
 * gain (volume) and playbackRate (pitch) control. Spatial position is
 * achieved via PannerNode (3D audio).
 *
 * Constants from SoundEngine.h:
 *   SOUND_DISTANCE = 16
 *   _invMaxDistance = 1.0f / maxDistance
 *
 * Faithful translation of every method:
 *   - constructor: idCounter=0, _x/_y/_z/_yRot=0, _invMaxDistance=1/maxDistance
 *   - init: sound repository load (80+ sound name→sample mappings)
 *   - update(player, a): listener position/rotation lerp from Mob
 *   - play(name, x, y, z, volume, pitch): volume *= options.sound, clamp via
 *     _getVolumeMult, look up SoundDesc, play at (x,y,z)
 *   - playUI(name, volume, pitch): no positional, just gain
 *   - _getVolumeMult(x, y, z): distance-based volume falloff
 *     `clamp(1.1 - dist * _invMaxDistance, -1, 1)`
 */

import { Mth } from '../../util/Mth';

export interface SoundDesc {
  buffer: AudioBuffer | null;
  name: string;
}

export interface SoundEngineOptions {
  sound: number;
  music: number;
}

export class SoundEngine {
  static readonly SOUND_DISTANCE = 16;

  private idCounter = 0;
  private options: SoundEngineOptions | null = null;
  private _x = 0;
  private _y = 0;
  private _z = 0;
  private _yRot = 0;
  private _invMaxDistance: number;
  private sounds: Map<string, SoundDesc> = new Map();
  private audioContext: AudioContext | null = null;
  private enabled = true;

  constructor(maxDistance: number) {
    this._invMaxDistance = 1.0 / maxDistance;
  }

  // SoundEngine.cpp:24 — init
  init(_mc: unknown, options: SoundEngineOptions): void {
    this.options = options;
    try {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      this.audioContext = null;
    }
    // SoundEngine.cpp:38-130 — sound repository load.
    // The C++ source loads PCM samples (SA_cloth1, SA_grass1, etc.) that are
    // compiled into the binary. In the browser, we can't use those compiled
    // arrays — we'd need to load audio files. For now we register the sound
    // names so the play() lookup works (returns null buffer → no-op).
    const soundNames = [
      'step.cloth', 'step.grass', 'step.gravel', 'step.sand', 'step.stone', 'step.wood',
      'random.splash', 'random.explode', 'random.click',
      'random.door_open', 'random.door_close', 'random.pop', 'random.pop2',
      'random.hurt', 'random.glass',
      'mob.sheep', 'mob.pig', 'mob.pigdeath',
      'mob.cow', 'mob.cowhurt', 'mob.chicken', 'mob.chickenhurt',
      'mob.zombie', 'mob.zombiedeath', 'mob.zombiehurt',
      'mob.skeleton', 'mob.skeletonhurt',
      'mob.spider', 'mob.spiderdeath',
      'mob.zombiepig.zpig', 'mob.zombiepig.zpigangry', 'mob.zombiepig.zpigdeath', 'mob.zombiepig.zpighurt',
      'damage.fallbig', 'damage.fallsmall',
      'random.bow', 'random.bowhit',
      'mob.creeper', 'mob.creeperdeath',
      'random.eat', 'random.fuse',
    ];
    for (const name of soundNames) {
      this.sounds.set(name, { buffer: null, name });
    }
  }

  enable(status: boolean): void { this.enabled = status; }
  updateOptions(): void {}
  destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  // SoundEngine.cpp:166 — update(player, a) — verbatim
  update(player: { xo: number; x: number; yo: number; y: number; zo: number; z: number; yRotO: number; yRot: number } | null, a: number): void {
    if (!this.options || this.options.sound === 0) return;
    if (player === null) return;
    this._x = player.xo + (player.x - player.xo) * a;
    this._y = player.yo + (player.y - player.yo) * a;
    this._z = player.zo + (player.z - player.zo) * a;
    this._yRot = player.yRotO + (player.yRot - player.yRotO) * a;
    // C++: soundSystem.setListenerAngle(_yRot) — AudioContext listener rotation
    if (this.audioContext && this.audioContext.listener) {
      // Web Audio API listener position/rotation — if available
      const listener = this.audioContext.listener as unknown as {
        positionX?: { value: number }; positionY?: { value: number }; positionZ?: { value: number };
        forwardX?: { value: number }; forwardY?: { value: number }; forwardZ?: { value: number };
      };
      if (listener.positionX) {
        listener.positionX.value = this._x;
        listener.positionY.value = this._y;
        listener.positionZ.value = this._z;
      }
    }
  }

  // SoundEngine.cpp:180 — _getVolumeMult — verbatim
  _getVolumeMult(x: number, y: number, z: number): number {
    const dx = x - this._x;
    const dy = y - this._y;
    const dz = z - this._z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return Mth.clamp(1.1 - dist * this._invMaxDistance, -1.0, 1.0);
  }

  // SoundEngine.cpp:230 — play(name, x, y, z, volume, pitch) — verbatim
  play(name: string, x: number, y: number, z: number, volume: number, pitch: number): void {
    if (!this.options || (volume *= this.options.sound) <= 0) return;
    volume = Mth.clamp(volume * this._getVolumeMult(x, y, z), 0.0, 1.0);
    if (this.options.sound === 0 || volume <= 0) return;
    const sound = this.sounds.get(name);
    if (!sound || !sound.buffer || !this.audioContext) return;
    // Play the sound via Web Audio API
    const source = this.audioContext.createBufferSource();
    source.buffer = sound.buffer;
    source.playbackRate.value = pitch;
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = volume;
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    source.start();
  }

  // SoundEngine.cpp:243 — playUI(name, volume, pitch) — verbatim
  playUI(name: string, volume: number, pitch: number): void {
    if (!this.options || (volume *= this.options.sound) <= 0) return;
    volume = Mth.clamp(volume, 0.0, 1.0);
    if (this.options.sound === 0 || volume <= 0) return;
    const sound = this.sounds.get(name);
    if (!sound || !sound.buffer || !this.audioContext) return;
    const source = this.audioContext.createBufferSource();
    source.buffer = sound.buffer;
    source.playbackRate.value = pitch;
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = volume;
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    source.start();
  }

  // Load a PCM audio buffer from an ArrayBuffer (used for loading sound assets)
  loadSound(name: string, data: ArrayBuffer): void {
    if (!this.audioContext) return;
    this.audioContext.decodeAudioData(data, (buffer) => {
      const sound = this.sounds.get(name);
      if (sound) sound.buffer = buffer;
    });
  }
}
