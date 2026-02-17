export const FIXED_DT = 1000 / 64; //64 tick rate
export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 720;

// Soldat-style physics
export const GRAVITY = 360;
export const JUMP_VELOCITY = -420;
export const MOVE_FORCE_GROUND = 700;
export const MOVE_FORCE_AIR = 180;
export const VELOCITY_DAMPING = Math.pow(0.99, 60 / (1000 / FIXED_DT));
export const SURFACE_FRICTION = Math.pow(0.97, 60 / (1000 / FIXED_DT));
export const MAX_VELOCITY = 660;

// Sidejump
export const SIDEJUMP_VERTICAL = -280;
export const SIDEJUMP_HORIZONTAL = 170;
export const JUMP_CUT_EXTRA_GRAVITY = 500;

// Jetpack
export const JETPACK_FUEL_MAX = 100;
export const JETPACK_BURN_RATE = 50;
export const JETPACK_REGEN_RATE = 20;
export const JETPACK_THRUST = 600;

export const GROUND_Y = 900;
export const PLAYER_RADIUS = 18;
export const SMOOTH_FACTOR = 0.15;
export const GUN_OFFSET = 10;
