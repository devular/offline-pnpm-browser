const plugin = {
  meta: { name: 'no-relative-imports' },
  rules: {
    'no-parent-imports': {
      create(context) {
        function check(node) {
          const source = node.source;
          if (!source) return;
          if (source.value.startsWith('../')) {
            context.report({
              node: source,
              message: `Relative parent imports are not allowed. Use "@root/${source.value.replace(/^(\.\.\/)+/, '')}" instead.`,
            });
          }
        }

        return {
          ImportDeclaration: check,
          ExportNamedDeclaration: check,
          ExportAllDeclaration: check,
        };
      },
    },
  },
};

export default plugin;
