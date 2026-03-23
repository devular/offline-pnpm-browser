function isPascalCase(name) {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name);
}

const plugin = {
  meta: { name: 'one-component-per-file' },
  rules: {
    'one-component-per-file': {
      create(context) {
        const functionStack = [];
        const components = new Map();

        function enterFunction(name, node) {
          functionStack.push({ name, node });
        }

        function exitFunction() {
          functionStack.pop();
        }

        function markComponent() {
          for (let i = functionStack.length - 1; i >= 0; i--) {
            const fn = functionStack[i];
            if (isPascalCase(fn.name)) {
              components.set(fn.name, fn.node);
              break;
            }
          }
        }

        return {
          FunctionDeclaration(node) {
            enterFunction(node.id?.name || '', node);
          },
          'FunctionDeclaration:exit'() {
            exitFunction();
          },
          FunctionExpression(node) {
            enterFunction(node.id?.name || '', node);
          },
          'FunctionExpression:exit'() {
            exitFunction();
          },
          ArrowFunctionExpression(node) {
            const parent = node.parent;
            const name = parent?.type === 'VariableDeclarator' ? parent.id?.name || '' : '';
            enterFunction(name, parent?.type === 'VariableDeclarator' ? parent : node);
          },
          'ArrowFunctionExpression:exit'() {
            exitFunction();
          },
          JSXElement() {
            markComponent();
          },
          JSXFragment() {
            markComponent();
          },
          'Program:exit'(node) {
            if (components.size > 1) {
              const names = [...components.keys()];
              const [, ...extras] = names;
              for (const name of extras) {
                context.report({
                  node: components.get(name),
                  message: `Only one component per file is allowed. Found ${components.size}: ${names.join(', ')}.`,
                });
              }
            }
          },
        };
      },
    },
  },
};

export default plugin;
