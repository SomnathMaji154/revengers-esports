module.exports = {
  // Formatting
  semi: true,
  trailingComma: 'none',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  
  // JavaScript
  arrowParens: 'avoid',
  bracketSpacing: true,
  bracketSameLine: false,
  
  // HTML
  htmlWhitespaceSensitivity: 'css',
  
  // JSON
  jsonStringify: false,
  
  // Markdown
  proseWrap: 'preserve',
  
  // End of line
  endOfLine: 'lf',
  
  // Override for specific file types
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 200
      }
    },
    {
      files: '*.md',
      options: {
        proseWrap: 'always',
        printWidth: 80
      }
    }
  ]
};