/**
 * Translation of: client/Options.{h,cpp}
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/client/Options.{h,cpp}
 *
 * Default values from Options::initDefaultValues() (Options.cpp:11):
 *   sensitivity = 0.5, viewDistance = 2, bobView = true, anaglyph3d = false,
 *   fancyGraphics = true, ambientOcclusion = false, invertYMouse = false,
 *   thirdPersonView = false, hideGui = false, difficulty = NORMAL (2),
 *   username = "Steve"
 *
 * Default key bindings from Options.cpp:42-60 (Keyboard::KEY_W etc. mapped to JS KeyCodes):
 *   keyUp = W, keyLeft = A, keyDown = S, keyRight = D, keyJump = SPACE,
 *   keyBuild = E, keySneak = LSHIFT, keyCraft = Q, keyDrop = Q, keyFog = F,
 *   keyChat = T
 */

export const KeyMapping = {
  keyUp: 'KeyW',
  keyLeft: 'KeyA',
  keyDown: 'KeyS',
  keyRight: 'KeyD',
  keyJump: 'Space',
  keyBuild: 'KeyE',
  keySneak: 'ShiftLeft',
  keyCraft: 'KeyQ',
  keyDrop: 'KeyQ',
  keyChat: 'KeyT',
  keyFog: 'KeyF',
} as const;

export interface OptionsConfig {
  sensitivity: number;
  viewDistance: number;
  bobView: boolean;
  anaglyph3d: boolean;
  invertYMouse: boolean;
  thirdPersonView: boolean;
  fixedCamera: boolean;
  hideGui: boolean;
  fancyGraphics: boolean;
  ambientOcclusion: boolean;
  isFlying: boolean;
  difficulty: number;
  limitFramerate: boolean;
  isLeftHanded: boolean;
  useTouchScreen: boolean;
  username: string;
  flySpeed: number;
  cameraSpeed: number;
  guiScale: number;
  smoothCamera: boolean;
  music: number;
  sound: number;
}

export function defaultOptions(): OptionsConfig {
  // Verbatim from Options::initDefaultValues.
  return {
    sensitivity: 0.5,
    viewDistance: 2,
    bobView: true,
    anaglyph3d: false,
    invertYMouse: false,
    thirdPersonView: false,
    fixedCamera: false,
    hideGui: false,
    fancyGraphics: true,
    ambientOcclusion: false,
    isFlying: false,
    difficulty: 2,  // NORMAL
    limitFramerate: false,
    isLeftHanded: false,
    useTouchScreen: false,
    username: 'Steve',
    flySpeed: 1,
    cameraSpeed: 1,
    guiScale: 0,
    smoothCamera: true,
    music: 1,
    sound: 1,
  };
}
