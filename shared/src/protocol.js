import { Schema } from "net-schema";

export const protocol = {
  ServerSnapshot: {
    id: 0,
    channel: "unreliable",
    fields: {},
  },
  ClientSnapshot: {
    id: 1,
    channel: "unreliable",
    fields: {},
  },
  Ready: {
    id: 2,
    channel: "reliable",
    fields: {},
  },
  Welcome: {
    id: 3,
    channel: "reliable",
    fields: {},
  },
  PlayerJoined: {
    id: 4,
    channel: "reliable",
    fields: {},
  },
  PlayerLeft: {
    id: 5,
    channel: "reliable",
    fields: {},
  },
};
