// JSON that keeps its key order.
//
// `JSON.parse` reorders integer-like keys ahead of the rest, in numeric order, before any reviver
// can see them. A locale file with a `"404"` key would come out reordered, and this CLI promises
// the target comes out in the source's key order. So objects become Maps, which order by
// insertion, and the writer walks a Map rather than an object.

import { CliError } from '../util.mjs';

const ESCAPES = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;
const WORDS = { true: true, false: false, null: null };

class Reader {
  constructor(text) {
    this.text = text;
    this.at = 0;
  }

  fail(what) {
    throw new CliError(`invalid JSON at position ${this.at}: expected ${what}`);
  }

  skip() {
    while (this.at < this.text.length && ' \t\n\r'.includes(this.text[this.at])) this.at += 1;
  }

  take(char) {
    this.skip();
    if (this.text[this.at] !== char) this.fail(char);
    this.at += 1;
  }

  string() {
    this.take('"');
    let out = '';
    while (this.at < this.text.length) {
      const char = this.text[this.at++];
      if (char === '"') return out;
      if (char !== '\\') {
        out += char;
        continue;
      }
      const code = this.text[this.at++];
      if (code === 'u') {
        out += String.fromCharCode(parseInt(this.text.slice(this.at, this.at + 4), 16));
        this.at += 4;
      } else if (code in ESCAPES) {
        out += ESCAPES[code];
      } else {
        this.fail('a valid escape');
      }
    }
    return this.fail('a closing quote');
  }

  members(close, add) {
    this.at += 1;
    this.skip();
    if (this.text[this.at] === close) {
      this.at += 1;
      return;
    }
    for (;;) {
      add();
      this.skip();
      if (this.text[this.at] === ',') {
        this.at += 1;
        continue;
      }
      this.take(close);
      return;
    }
  }

  value() {
    this.skip();
    const char = this.text[this.at];
    if (char === '{') {
      const map = new Map();
      this.members('}', () => {
        const key = this.string();
        this.take(':');
        map.set(key, this.value());
      });
      return map;
    }
    if (char === '[') {
      const list = [];
      this.members(']', () => list.push(this.value()));
      return list;
    }
    if (char === '"') return this.string();
    for (const [word, value] of Object.entries(WORDS)) {
      if (this.text.startsWith(word, this.at)) {
        this.at += word.length;
        return value;
      }
    }
    const number = NUMBER.exec(this.text.slice(this.at));
    if (!number) this.fail('a value');
    this.at += number[0].length;
    return Number(number[0]);
  }
}

export function parseOrdered(text) {
  const reader = new Reader(text);
  const value = reader.value();
  reader.skip();
  if (reader.at !== text.length) reader.fail('end of input');
  return value;
}

function write(value, indent, depth) {
  const pad = ' '.repeat(indent * (depth + 1));
  const shut = ' '.repeat(indent * depth);
  if (value instanceof Map) {
    if (value.size === 0) return '{}';
    const body = [...value]
      .map(([key, item]) => `${pad}${JSON.stringify(key)}: ${write(item, indent, depth + 1)}`)
      .join(',\n');
    return `{\n${body}\n${shut}}`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const body = value.map((item) => pad + write(item, indent, depth + 1)).join(',\n');
    return `[\n${body}\n${shut}]`;
  }
  return JSON.stringify(value);
}

export function stringifyOrdered(value, indent = 2) {
  return write(value, indent, 0);
}

export function cloneOrdered(value) {
  if (value instanceof Map) return new Map([...value].map(([k, v]) => [k, cloneOrdered(v)]));
  if (Array.isArray(value)) return value.map(cloneOrdered);
  return value;
}
