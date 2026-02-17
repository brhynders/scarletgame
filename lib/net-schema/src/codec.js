const INITIAL_BUFFER_SIZE = 256;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export class BinaryWriter {
  constructor(initialSize = INITIAL_BUFFER_SIZE) {
    this.buf = new ArrayBuffer(initialSize);
    this.view = new DataView(this.buf);
    this.pos = 0;
  }

  ensure(bytes) {
    if (this.pos + bytes <= this.buf.byteLength) return;
    let newSize = this.buf.byteLength * 2;
    while (newSize < this.pos + bytes) newSize *= 2;
    const newBuf = new ArrayBuffer(newSize);
    new Uint8Array(newBuf).set(new Uint8Array(this.buf));
    this.buf = newBuf;
    this.view = new DataView(this.buf);
  }

  u8(v)  { this.ensure(1); this.view.setUint8(this.pos, v); this.pos += 1; }
  u16(v) { this.ensure(2); this.view.setUint16(this.pos, v, true); this.pos += 2; }
  u32(v) { this.ensure(4); this.view.setUint32(this.pos, v, true); this.pos += 4; }
  i8(v)  { this.ensure(1); this.view.setInt8(this.pos, v); this.pos += 1; }
  i16(v) { this.ensure(2); this.view.setInt16(this.pos, v, true); this.pos += 2; }
  i32(v) { this.ensure(4); this.view.setInt32(this.pos, v, true); this.pos += 4; }
  f32(v) { this.ensure(4); this.view.setFloat32(this.pos, v, true); this.pos += 4; }
  f64(v) { this.ensure(8); this.view.setFloat64(this.pos, v, true); this.pos += 8; }
  bool(v) { this.u8(v ? 1 : 0); }

  string(v) {
    const encoded = textEncoder.encode(v);
    this.u16(encoded.length);
    this.ensure(encoded.length);
    new Uint8Array(this.buf, this.pos, encoded.length).set(encoded);
    this.pos += encoded.length;
  }

  finish() {
    return new Uint8Array(this.buf, 0, this.pos);
  }

  reset() {
    this.pos = 0;
  }
}

export class BinaryReader {
  constructor(data) {
    if (data instanceof Uint8Array) {
      this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      this.bytes = data;
    } else {
      this.view = new DataView(data);
      this.bytes = new Uint8Array(data);
    }
    this.pos = 0;
  }

  u8()  { const v = this.view.getUint8(this.pos); this.pos += 1; return v; }
  u16() { const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
  u32() { const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
  i8()  { const v = this.view.getInt8(this.pos); this.pos += 1; return v; }
  i16() { const v = this.view.getInt16(this.pos, true); this.pos += 2; return v; }
  i32() { const v = this.view.getInt32(this.pos, true); this.pos += 4; return v; }
  f32() { const v = this.view.getFloat32(this.pos, true); this.pos += 4; return v; }
  f64() { const v = this.view.getFloat64(this.pos, true); this.pos += 8; return v; }
  bool() { return this.u8() !== 0; }

  string() {
    const len = this.u16();
    const str = textDecoder.decode(this.bytes.subarray(this.pos, this.pos + len));
    this.pos += len;
    return str;
  }
}

// --- Field encoder/decoder generators ---

function makeFieldEncoder(ft) {
  switch (ft._tag) {
    case 'u8':     return (w, v) => w.u8(v);
    case 'u16':    return (w, v) => w.u16(v);
    case 'u32':    return (w, v) => w.u32(v);
    case 'i8':     return (w, v) => w.i8(v);
    case 'i16':    return (w, v) => w.i16(v);
    case 'i32':    return (w, v) => w.i32(v);
    case 'f32':    return (w, v) => w.f32(v);
    case 'f64':    return (w, v) => w.f64(v);
    case 'bool':   return (w, v) => w.bool(v);
    case 'string': return (w, v) => w.string(v);
    case 'array': {
      const elemEnc = makeFieldEncoder(ft.element);
      return (w, v) => {
        w.u16(v.length);
        for (let i = 0; i < v.length; i++) elemEnc(w, v[i]);
      };
    }
    case 'struct': {
      const entries = makeFieldMapEncoder(ft.fields);
      return (w, v) => {
        for (const [key, enc] of entries) enc(w, v[key]);
      };
    }
  }
}

function makeFieldDecoder(ft) {
  switch (ft._tag) {
    case 'u8':     return (r) => r.u8();
    case 'u16':    return (r) => r.u16();
    case 'u32':    return (r) => r.u32();
    case 'i8':     return (r) => r.i8();
    case 'i16':    return (r) => r.i16();
    case 'i32':    return (r) => r.i32();
    case 'f32':    return (r) => r.f32();
    case 'f64':    return (r) => r.f64();
    case 'bool':   return (r) => r.bool();
    case 'string': return (r) => r.string();
    case 'array': {
      const elemDec = makeFieldDecoder(ft.element);
      return (r) => {
        const count = r.u16();
        const arr = new Array(count);
        for (let i = 0; i < count; i++) arr[i] = elemDec(r);
        return arr;
      };
    }
    case 'struct': {
      const entries = makeFieldMapDecoder(ft.fields);
      return (r) => {
        const obj = {};
        for (const [key, dec] of entries) obj[key] = dec(r);
        return obj;
      };
    }
  }
}

function makeFieldMapEncoder(fields) {
  return Object.entries(fields).map(([key, ft]) => [key, makeFieldEncoder(ft)]);
}

function makeFieldMapDecoder(fields) {
  return Object.entries(fields).map(([key, ft]) => [key, makeFieldDecoder(ft)]);
}

// --- Codec ---

export function createCodec(schema) {
  const byName = new Map();
  const byId = new Map();

  for (const [name, def] of Object.entries(schema)) {
    const entry = {
      name,
      id: def.id,
      channel: def.channel,
      encoders: makeFieldMapEncoder(def.fields),
      decoders: makeFieldMapDecoder(def.fields),
    };
    byName.set(name, entry);
    byId.set(def.id, entry);
  }

  const writer = new BinaryWriter();

  return {
    encode(msg) {
      const entry = byName.get(msg.type);
      if (!entry) throw new Error(`Unknown message type: ${String(msg.type)}`);

      writer.reset();
      writer.u8(entry.id);
      for (const [key, enc] of entry.encoders) {
        enc(writer, msg[key]);
      }
      // Return a copy so the writer can be reused
      const result = writer.finish();
      return result.slice();
    },

    decode(data) {
      const reader = new BinaryReader(data);
      const id = reader.u8();
      const entry = byId.get(id);
      if (!entry) throw new Error(`Unknown message id: ${id}`);

      const msg = { type: entry.name };
      for (const [key, dec] of entry.decoders) {
        msg[key] = dec(reader);
      }
      return msg;
    },

    channelFor(msg) {
      const entry = byName.get(msg.type);
      if (!entry) throw new Error(`Unknown message type: ${String(msg.type)}`);
      return entry.channel;
    },
  };
}
