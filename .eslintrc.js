module.exports = {
  env: {
    browser: true,
    es2022: true,
    node: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: [
    'security',
    'no-unsanitized'
  ],
  rules: {
    // Code Quality Rules
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_' 
    }],
    'no-undef': 'error',
    'no-redeclare': 'error',
    'no-shadow': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'brace-style': ['error', '1tbs'],
    'indent': ['error', 2, { SwitchCase: 1 }],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'no-trailing-spaces': 'error',
    'eol-last': 'error',
    'max-len': ['warn', { code: 120, ignoreUrls: true }],
    'max-lines': ['warn', { max: 500, skipBlankLines: true }],
    'max-complexity': ['warn', 10],
    'max-depth': ['warn', 4],
    'max-nested-callbacks': ['warn', 3],
    'max-params': ['warn', 5],

    // Security Rules
    'security/detect-object-injection': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-possible-timing-attacks': 'warn',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'warn',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-require': 'warn',
    'security/detect-bidi-characters': 'error',

    // XSS Prevention
    'no-unsanitized/method': 'error',
    'no-unsanitized/property': 'error',

    // Best Practices
    'array-callback-return': 'error',
    'block-scoped-var': 'error',
    'consistent-return': 'error',
    'default-case': 'error',
    'dot-notation': 'error',
    'guard-for-in': 'error',
    'no-caller': 'error',
    'no-case-declarations': 'error',
    'no-else-return': 'error',
    'no-empty-function': 'error',
    'no-empty-pattern': 'error',
    'no-eq-null': 'error',
    'no-extend-native': 'error',
    'no-extra-bind': 'error',
    'no-fallthrough': 'error',
    'no-floating-decimal': 'error',
    'no-global-assign': 'error',
    'no-implicit-coercion': 'error',
    'no-implicit-globals': 'error',
    'no-invalid-this': 'error',
    'no-iterator': 'error',
    'no-labels': 'error',
    'no-lone-blocks': 'error',
    'no-loop-func': 'error',
    'no-magic-numbers': ['warn', { 
      ignore: [-1, 0, 1, 2, 100, 1000],
      enforceConst: true 
    }],
    'no-multi-spaces': 'error',
    'no-multi-str': 'error',
    'no-new': 'error',
    'no-new-wrappers': 'error',
    'no-octal': 'error',
    'no-octal-escape': 'error',
    'no-param-reassign': 'error',
    'no-proto': 'error',
    'no-return-assign': 'error',
    'no-return-await': 'error',
    'no-self-assign': 'error',
    'no-self-compare': 'error',
    'no-sequences': 'error',
    'no-throw-literal': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-unused-expressions': 'error',
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-useless-escape': 'error',
    'no-useless-return': 'error',
    'no-void': 'error',
    'no-warning-comments': 'warn',
    'no-with': 'error',
    'prefer-promise-reject-errors': 'error',
    'radix': 'error',
    'require-await': 'error',
    'vars-on-top': 'error',
    'wrap-iife': 'error',
    'yoda': 'error'
  },
  overrides: [
    {
      files: ['backend/**/*.js'],
      env: {
        node: true,
        browser: false
      },
      rules: {
        'no-process-exit': 'error',
        'no-process-env': 'warn',
        'global-require': 'error',
        'handle-callback-err': 'error',
        'no-buffer-constructor': 'error',
        'no-mixed-requires': 'error',
        'no-new-require': 'error',
        'no-path-concat': 'error',
        'no-sync': 'warn'
      }
    },
    {
      files: ['*.html'],
      parser: '@html-eslint/parser',
      plugins: ['@html-eslint'],
      rules: {
        '@html-eslint/require-doctype': 'error',
        '@html-eslint/require-lang': 'error',
        '@html-eslint/require-meta-charset': 'error',
        '@html-eslint/require-meta-viewport': 'error',
        '@html-eslint/no-duplicate-id': 'error',
        '@html-eslint/no-inline-styles': 'warn',
        '@html-eslint/require-img-alt': 'error',
        '@html-eslint/require-button-type': 'error',
        '@html-eslint/no-script-style-type': 'error'
      }
    }
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '*.min.js',
    'service-worker.js'
  ]
};