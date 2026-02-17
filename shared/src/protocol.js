import { Schema } from "net-schema";

const PlayerStruct = Schema.struct({
  id: Schema.u8,
  x: Schema.f32,
  y: Schema.f32,
  vx: Schema.f32,
  vy: Schema.f32,
  angle: Schema.f32,
  weaponType: Schema.u8,
  health: Schema.u8,
});

export const protocol = {
  ServerSnapshot: {
    id: 0,
    channel: "unreliable",
    fields: {
      tick: Schema.u32,
      players: Schema.array(PlayerStruct),
    },
  },
  ClientSnapshot: {
    id: 1,
    channel: "unreliable",
    fields: {
      tick: Schema.u32,
      x: Schema.f32,
      y: Schema.f32,
      vx: Schema.f32,
      vy: Schema.f32,
      angle: Schema.f32,
    },
  },
  Ready: {
    id: 2,
    channel: "reliable",
    fields: {},
  },
  Welcome: {
    id: 3,
    channel: "reliable",
    fields: {
      playerId: Schema.u8,
      map: Schema.string,
      players: Schema.array(PlayerStruct),
    },
  },
  PlayerJoined: {
    id: 4,
    channel: "reliable",
    fields: {
      id: Schema.u8,
      x: Schema.f32,
      y: Schema.f32,
    },
  },
  PlayerLeft: {
    id: 5,
    channel: "reliable",
    fields: {
      id: Schema.u8,
    },
  },
  RoundStart: {
    id: 6,
    channel: "reliable",
    fields: {
      map: Schema.string,
    },
  },
  Shoot: {
    id: 7,
    channel: "unreliable",
    fields: {
      ownerId: Schema.u8,
      weaponType: Schema.u8,
      x: Schema.f32,
      y: Schema.f32,
      velX: Schema.f32,
      velY: Schema.f32,
    },
  },
  BulletHit: {
    id: 8,
    channel: "reliable",
    fields: {
      targetId: Schema.u8,
      attackerId: Schema.u8,
      damage: Schema.u8,
      health: Schema.u8,
      x: Schema.f32,
      y: Schema.f32,
    },
  },
};
