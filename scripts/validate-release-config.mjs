import fs from 'node:fs/promises';
import {assertPublicConfig} from '../src/update/release-contract.js';
const config=JSON.parse(await fs.readFile(new URL('../release/loader.config.json',import.meta.url),'utf8'));
assertPublicConfig(config,{requireFallback:false});
console.log('PUBLIC_CONFIGURATION_OK');
