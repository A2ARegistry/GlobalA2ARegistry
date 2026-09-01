/**
 * Node.js Native DNS Resolver Adapter for @a2a-registry/validate CLI
 */
const dns = require('node:dns/promises');

async function resolveTxtRecords(domain) {
  try {
    const records = await dns.resolveTxt(`_a2a.${domain}`);
    return records.map(chunks => chunks.join(''));
  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      return [];
    }
    throw err;
  }
}

module.exports = {
  resolveTxtRecords
};
