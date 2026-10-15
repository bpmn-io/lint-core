import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { expect, stubCJS } from '../helper.mjs';

const {
  __dirname,
  require
} = stubCJS(import.meta.url);

const root = join(__dirname, '../..');

const pkg = require('../../package.json');


describe('exports', function() {

  function targets(value) {

    if (typeof value === 'string') {
      return [ value ];
    }

    return Object.values(value).flatMap(targets);
  }


  it('should point to existing files', function() {

    // when
    const missing = Object.entries(pkg.exports).flatMap(([ key, value ]) => {
      return targets(value).filter(target => !existsSync(join(root, target))).map(target => `${ key } -> ${ target }`);
    });

    // then
    expect(missing).to.eql([]);
  });


  it('should NOT expose <.js> variants', function() {

    // when
    const variants = Object.keys(pkg.exports).filter(key => key.endsWith('.js'));

    // then
    expect(variants).to.eql([]);
  });


  it('should resolve exported modules', function() {

    // when
    const resolved = [
      '@bpmn-io/lint-core',
      '@bpmn-io/lint-core/lib/linter',
      '@bpmn-io/lint-core/lib/resolver/node-resolver',
      '@bpmn-io/lint-core/lib/testers/rule-tester',
      '@bpmn-io/lint-core/package.json'
    ].map(id => require.resolve(id));

    // then
    expect(resolved).to.have.length(5);
  });


  it('should NOT expose internals', function() {

    [
      '@bpmn-io/lint-core/lib/product',
      '@bpmn-io/lint-core/lib/index',
      '@bpmn-io/lint-core/lib/linter.js'
    ].forEach(id => {

      expect(() => require.resolve(id), id).to.throw().with.property('code', 'ERR_PACKAGE_PATH_NOT_EXPORTED');
    });
  });

});
