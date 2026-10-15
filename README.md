# @bpmn-io/lint-core

Shared implementation of [bpmnlint](https://github.com/bpmn-io/bpmnlint) and [dmnlint](https://github.com/bpmn-io/dmnlint).

> **This package is an implementation detail.**
> It has no stable API and may change in any release.
> Depend on [`bpmnlint`](https://github.com/bpmn-io/bpmnlint) or [`dmnlint`](https://github.com/bpmn-io/dmnlint) instead.

## How it works

Every module is a factory that is bound to a _product_:

```javascript
const { createLinter } = require('@bpmn-io/lint-core');

const product = {
  name: 'bpmnlint',

  // optional, defaults to `${ name }-plugin-`
  pluginPrefix: 'bpmnlint-plugin-'
};

const Linter = createLinter(product);
```

The product determines

* the package that rules and configurations are loaded from by default (`name`)
* how plugins are named (`pluginPrefix`)

## License

MIT
