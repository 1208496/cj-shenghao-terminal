// 把整卡 JSON 塞进 PNG（tEXt: chara + ccv3），产出可被 SillyTavern 导入的角色卡。
// 用法：node scripts/pack-card-png.mjs <base.png> <card.json> <out.png>
import fs from 'node:fs';
import zlib from 'node:zlib';

const [base, jsonPath, out] = process.argv.slice(2);
if (!base || !jsonPath || !out) {
  console.error('用法: node pack-card-png.mjs <base.png> <card.json> <out.png>');
  process.exit(2);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
const textChunk = (key, value) => chunk('tEXt', Buffer.concat([Buffer.from(key, 'latin1'), Buffer.from([0]), Buffer.from(value, 'latin1')]));

const png = fs.readFileSync(base);
if (png.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG：' + base);
const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const payload = Buffer.from(JSON.stringify(json), 'utf8').toString('base64');

const parts = [png.subarray(0, 8)];
let off = 8;
while (off < png.length) {
  const len = png.readUInt32BE(off);
  const type = png.toString('latin1', off + 4, off + 8);
  const data = png.subarray(off + 8, off + 8 + len);
  const whole = png.subarray(off, off + 12 + len);
  const isText = ['tEXt', 'iTXt', 'zTXt'].includes(type);
  const keyword = isText ? data.subarray(0, Math.max(0, data.indexOf(0))).toString('latin1') : '';
  if (type === 'IEND') {
    parts.push(textChunk('chara', payload));
    parts.push(textChunk('ccv3', payload));
    parts.push(whole);
  } else if (!(isText && ['chara', 'ccv3'].includes(keyword))) {
    parts.push(whole);
  }
  off += 12 + len;
}
const result = Buffer.concat(parts);
fs.writeFileSync(out, result);
console.log('PACK_OK', JSON.stringify({ out, bytes: result.length, jsonBytes: Buffer.byteLength(JSON.stringify(json)) }));
