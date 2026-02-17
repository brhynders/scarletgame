# net-schema

Binary protocol schema and codec for defining multiplayer network messages.

## Usage

```js
import { Schema, createCodec } from "net-schema";
```

### Defining a protocol

Each message needs a unique numeric `id`, a `channel` (`"reliable"` or `"unreliable"`), and a `fields` map:

```js
const protocol = {
  join: {
    id: 1,
    channel: "reliable",
    fields: {
      name: Schema.string,
    },
  },
  position: {
    id: 2,
    channel: "unreliable",
    fields: {
      x: Schema.f32,
      y: Schema.f32,
    },
  },
};
```

### Primitive types

`Schema.u8`, `Schema.u16`, `Schema.u32`, `Schema.i8`, `Schema.i16`, `Schema.i32`, `Schema.f32`, `Schema.f64`, `Schema.bool`, `Schema.string`

### Composite types

```js
// Variable-length array of a field type
Schema.array(Schema.u16);

// Nested struct
Schema.struct({ x: Schema.f32, y: Schema.f32 });

// Composable — array of structs, etc.
Schema.array(Schema.struct({ id: Schema.u8, value: Schema.f64 }));
```

### Encoding and decoding

```js
const codec = createCodec(protocol);

// Encode a message to a Uint8Array
const bytes = codec.encode({ type: "position", x: 1.5, y: 3.0 });

// Decode a Uint8Array back to a message object
const msg = codec.decode(bytes);
// => { type: 'position', x: 1.5, y: 3.0 }

// Look up which channel a message should be sent on
codec.channelFor(msg);
// => 'unreliable'
```

## Wire format

All multi-byte values are little-endian. Messages are prefixed with a single `u8` message id. Strings are length-prefixed with a `u16` byte count. Arrays are length-prefixed with a `u16` element count.
