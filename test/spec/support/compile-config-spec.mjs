import { createCompileConfig } from '../../../lib/support/compile-config.js';

import { createLinter } from '../../../lib/linter.js';

import { createNodeResolver } from '../../../lib/resolver/node-resolver.js';

import { createScopedRequire } from '../../../lib/resolver/helper.js';

import { expect } from '../../helper.mjs';

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';


describe('support/compile-config', function() {

  const product = { name: 'foolint' };

  const Linter = createLinter(product);

  const NodeResolver = createNodeResolver(product, {
    requireLocal: function() {
      return () => ({ check() {} });
    }
  });

  const compileConfig = createCompileConfig({ Linter, NodeResolver });


  it('should create named function', function() {
    expect(compileConfig.name).to.eql('compileConfig');
  });


  it('should import rules from product package', async function() {

    // when
    const code = await compileConfig({
      rules: {
        'a': 'error',
        'b': 'off',
        'foolint/c': 'warn'
      }
    });

    // then
    expect(code).to.contain('import rule_0 from \'foolint/rules/a\'');
    expect(code).to.contain('cache[\'foolint/a\'] = rule_0');

    expect(code).to.contain('import rule_2 from \'foolint/rules/c\'');
    expect(code).to.contain('cache[\'foolint/c\'] = rule_2');

    expect(code).not.to.contain('foolint/rules/b');

    expect(code).to.contain('"b": 0');
  });


  it('should import rules from plugin', async function() {

    // given
    const resolver = new NodeResolver({
      require: Object.assign(
        function(path) {

          if (path === './package.json') {
            return { name: 'foolint-plugin-local' };
          }

          throw new Error('not found: ' + path);
        },
        { resolve() {} }
      )
    });

    // when
    const code = await compileConfig({
      rules: {
        'bar/d': 'error'
      }
    }, resolver);

    // then
    expect(code).to.contain('import rule_0 from \'foolint-plugin-bar/rules/d\'');
    expect(code).to.contain('cache[\'foolint-plugin-bar/d\'] = rule_0');
  });


  describe('package <exports>', function() {

    let root;

    before(function() {
      root = mkdtempSync(join(tmpdir(), 'lint-core-compile-config-'));

      createPackages(root, {

        // declares explicit file extensions only
        'foolint': {
          exports: {
            '.': './index.js',
            './rules/*.js': './rules/*.js'
          },
          files: [ 'index.js', 'rules/a.js' ]
        },

        // no <exports>
        'foolint-plugin-plain': {
          files: [ 'index.js', 'rules/b.js' ]
        },

        // <exports> without file extensions
        'foolint-plugin-extensionless': {
          exports: {
            '.': './index.js',
            './rules/*': './rules/*.js'
          },
          files: [ 'index.js', 'rules/c.js' ]
        },

        // declares explicit file extensions only
        'foolint-plugin-explicit': {
          exports: {
            '.': './index.js',
            './rules/*.js': './rules/*.js'
          },
          files: [ 'index.js', 'rules/d.js' ]
        },

        // exports rules by reference
        'foolint-plugin-mapped': {
          exports: {
            '.': './index.js',
            './package.json': './package.json',
            './src/*.js': './src/*.js'
          },
          index: 'module.exports = { rules: { e: \'./src/e\' } };',
          files: [ 'src/e.js' ]
        }
      });
    });

    after(function() {
      rmSync(root, { recursive: true, force: true });
    });


    function createResolver() {
      return new NodeResolver({
        require: createScopedRequire(root)
      });
    }


    it('should import rule via file extension', async function() {

      // when
      const code = await compileConfig({
        rules: {
          'a': 'error'
        }
      }, createResolver());

      // then
      expect(code).to.contain('import rule_0 from \'foolint/rules/a.js\';');
      expect(code).to.contain('cache[\'foolint/a\'] = rule_0');
    });


    it('should import rule via file extension from plugin', async function() {

      // given
      const resolver = createResolver();

      // rule loading is not subject of this test
      resolver.resolveRule = () => ({ check() {} });

      // when
      const code = await compileConfig({
        rules: {
          'explicit/d': 'error'
        }
      }, resolver);

      // then
      expect(code).to.contain('import rule_0 from \'foolint-plugin-explicit/rules/d.js\';');
      expect(code).to.contain('cache[\'foolint-plugin-explicit/d\'] = rule_0');
    });


    it('should import rule referenced by plugin via file extension', async function() {

      // when
      const code = await compileConfig({
        rules: {
          'mapped/e': 'error'
        }
      }, createResolver());

      // then
      expect(code).to.contain('import rule_0 from \'foolint-plugin-mapped/src/e.js\';');
      expect(code).to.contain('cache[\'foolint-plugin-mapped/e\'] = rule_0');
    });


    it('should import rule from plugin without <exports> as is', async function() {

      // when
      const code = await compileConfig({
        rules: {
          'plain/b': 'error'
        }
      }, createResolver());

      // then
      expect(code).to.contain('import rule_0 from \'foolint-plugin-plain/rules/b\';');
      expect(code).to.contain('cache[\'foolint-plugin-plain/b\'] = rule_0');
    });


    it('should import rule from plugin exporting without file extension as is', async function() {

      // when
      const code = await compileConfig({
        rules: {
          'extensionless/c': 'error'
        }
      }, createResolver());

      // then
      expect(code).to.contain('import rule_0 from \'foolint-plugin-extensionless/rules/c\';');
      expect(code).to.contain('cache[\'foolint-plugin-extensionless/c\'] = rule_0');
    });


    it('should import unresolvable rule as is', async function() {

      // when
      const code = await compileConfig({
        rules: {
          'missing': 'error',
          'plain/missing': 'error'
        }
      }, createResolver());

      // then
      expect(code).to.contain('import rule_0 from \'foolint/rules/missing\';');
      expect(code).to.contain('import rule_1 from \'foolint-plugin-plain/rules/missing\';');
    });

  });

});


function createPackages(root, packages) {

  for (const [ name, { exports, index, files } ] of Object.entries(packages)) {
    const dir = join(root, 'node_modules', name);

    const pkg = { name, version: '0.0.0', main: 'index.js' };

    if (exports) {
      pkg.exports = exports;
    }

    writeFile(join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
    writeFile(join(dir, 'index.js'), index || 'module.exports = {};');

    for (const file of files) {
      writeFile(join(dir, file), 'module.exports = () => ({ check() {} });');
    }
  }
}

function writeFile(path, contents) {
  mkdirSync(dirname(path), { recursive: true });

  writeFileSync(path, contents);
}
