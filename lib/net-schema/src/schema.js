export const Schema = {
  u8:     { _tag: 'u8',     _size: 1  },
  u16:    { _tag: 'u16',    _size: 2  },
  u32:    { _tag: 'u32',    _size: 4  },
  i8:     { _tag: 'i8',     _size: 1  },
  i16:    { _tag: 'i16',    _size: 2  },
  i32:    { _tag: 'i32',    _size: 4  },
  f32:    { _tag: 'f32',    _size: 4  },
  f64:    { _tag: 'f64',    _size: 8  },
  bool:   { _tag: 'bool',   _size: 1  },
  string: { _tag: 'string', _size: -1 },

  array(element) {
    return { _tag: 'array', element };
  },

  struct(fields) {
    return { _tag: 'struct', fields };
  },
};
