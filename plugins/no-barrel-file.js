const plugin = {
  meta: { name: 'no-barrel-file' },
  rules: {
    'no-barrel-file': {
      create(context) {
        let totalStatements = 0;
        let reExportStatements = 0;

        return {
          ExportNamedDeclaration(node) {
            totalStatements++;
            if (node.source) {
              reExportStatements++;
            }
          },
          ExportAllDeclaration() {
            totalStatements++;
            reExportStatements++;
          },
          ExportDefaultDeclaration() {
            totalStatements++;
          },
          ImportDeclaration() {
            totalStatements++;
          },
          VariableDeclaration() {
            totalStatements++;
          },
          FunctionDeclaration() {
            totalStatements++;
          },
          ClassDeclaration() {
            totalStatements++;
          },
          ExpressionStatement() {
            totalStatements++;
          },
          'Program:exit'(node) {
            if (reExportStatements > 0 && reExportStatements === totalStatements) {
              context.report({
                node,
                message:
                  'Barrel files are not allowed. Import directly from the source module instead of re-exporting.',
              });
            }
          },
        };
      },
    },
  },
};

export default plugin;
