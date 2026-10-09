const fs = require('fs');
const path = require('path');

const rules = fs.readFileSync(
  path.join(__dirname, '..', '..', 'storage.rules'),
  'utf8'
);

describe('storage.rules', () => {
  it('denies by default and keeps no bucket-wide grant', () => {
    const catchAll = rules.match(/match\s+\/\{allPaths=\*\*\}\s*\{[\s\S]*?\n\s*\}/);
    expect(catchAll).not.toBeNull();
    expect(catchAll[0]).toMatch(/allow\s+read\s*,\s*write\s*:\s*if\s+false/);
    expect(catchAll[0]).not.toMatch(/if\s+true/);
    expect(catchAll[0]).not.toMatch(/request\.auth\s*!=\s*null/);
  });

  it('scopes avatar writes to the file owner', () => {
    expect(rules).toMatch(/match\s+\/avatars\/\{fileName\}/);
    expect(rules).toMatch(/fileName\s*==\s*request\.auth\.uid\s*\+\s*'\.jpg'/);
    expect(rules).toMatch(/fileName\s*==\s*request\.auth\.uid\s*\+\s*'\.png'/);
  });

  it('does not use partial-segment wildcards, which are invalid Storage rule syntax', () => {
    expect(rules).not.toMatch(/\{\w+\}\./);
  });

  it('scopes run photo writes to the owner and requires auth to read', () => {
    const block = rules.match(/match\s+\/runPhotos\/\{userId\}\/\{photoId\}\s*\{[\s\S]*?\n\s*\}/);
    expect(block).not.toBeNull();
    expect(block[0]).toMatch(/allow\s+read\s*:\s*if\s+request\.auth\s*!=\s*null/);
    expect(block[0]).toMatch(
      /allow\s+write\s*:\s*if\s+request\.auth\s*!=\s*null\s*&&\s*request\.auth\.uid\s*==\s*userId/
    );
  });
});
