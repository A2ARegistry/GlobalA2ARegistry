/**
 * Compile the A2A v1.0 JSON Schema into a standalone Ajv validator.
 *
 * Input:  src/schema.js  (the single source of truth)
 * Output: src/validator-compiled.js   — pre-compiled Ajv ESM standalone function
 *         src/schema.json             — raw JSON Schema (for tooling / $id dereferencing)
 *
 * Run via: node scripts/compile-schema.mjs
 * Hooked to: npm run build  and  npm run prepublishOnly
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const SRC_DIR    = path.resolve(__dirname, '../src');

async function main() {
    // 1. Load the schema definition
    const schemaModule = await import(pathToFileURL(path.join(SRC_DIR, 'schema.js')).href);
    const schema = schemaModule.A2A_V1_SCHEMA || schemaModule.default;

    if (!schema) {
        console.error('compile-schema: could not find A2A_V1_SCHEMA export in src/schema.js');
        process.exit(1);
    }

    // 2. Compile with Ajv standalone (ESM output)
    // optimize: 0 is critical for CF Workers compatibility — without it Ajv
    // emits require("ajv/dist/runtime/ucs2length") which is a CJS runtime
    // dependency that Wrangler cannot resolve in the edge bundle.
    // With optimize: 0 the minLength checks use a plain string .length
    // comparison instead, so the compiled output has zero external requires.
    const ajv = new Ajv2020({
        code: { source: true, esm: true },
        allErrors: true,
        strict: false,
        optimize: 0,
    });
    addFormats(ajv);

    const validateFn = ajv.compile(schema);
    let moduleCode = standaloneCode(ajv, validateFn);

    // Post-process: inline the two runtime require() calls so the output is
    // a pure self-contained ESM module with zero external dependencies.
    // This makes it safe to import from Cloudflare Workers and other
    // environments that cannot resolve CJS requires at runtime.
    //
    // 1. ajv/dist/runtime/ucs2length — counts Unicode code points in a string
    //    (used for minLength validation). Inlined verbatim from Ajv source.
    const ucs2lengthFn = `function ucs2length(str){const len=str.length;let length=0,pos=0,value;while(pos<len){length++;value=str.charCodeAt(pos++);if(value>=0xD800&&value<=0xDBFF&&pos<len){value=str.charCodeAt(pos);if((value&0xFC00)===0xDC00)pos++;}}return length;}`;
    moduleCode = moduleCode.replace(
        /const func\d+ = require\("ajv\/dist\/runtime\/ucs2length"\)\.default;/g,
        `const func2 = ucs2length; ${ucs2lengthFn}`
    );

    // 2. ajv-formats/dist/formats — provides URI format validation.
    //    Replace with a simple URI regex check that covers the same cases.
    //    Ajv standalone code calls formats0(value) directly as a function.
    const uriFn = `function formats0(str){try{return Boolean(new URL(str));}catch{return false;}}`;
    moduleCode = moduleCode.replace(
        /const formats\d+ = require\("ajv-formats\/dist\/formats"\)\.fullFormats\.uri;/g,
        uriFn
    );

    // Verify no require() calls remain
    const remainingRequires = [...moduleCode.matchAll(/require\([^)]+\)/g)];
    if (remainingRequires.length > 0) {
        console.error('compile-schema: unexpected require() calls remain after inlining:');
        remainingRequires.forEach(m => console.error(' ', m[0]));
        process.exit(1);
    }

    // 3. Write pre-compiled validator
    const outValidator = path.join(SRC_DIR, 'validator-compiled.js');
    fs.writeFileSync(outValidator, moduleCode, 'utf8');
    console.log(`✓ Compiled Ajv standalone validator → src/validator-compiled.js`);

    // 4. Write raw schema JSON (for $id dereferencing / IDE tooling)
    const outSchema = path.join(SRC_DIR, 'schema.json');
    fs.writeFileSync(outSchema, JSON.stringify(schema, null, 2), 'utf8');
    console.log(`✓ Wrote raw JSON Schema            → src/schema.json`);
}

main().catch(err => {
    console.error('compile-schema failed:', err);
    process.exit(1);
});
