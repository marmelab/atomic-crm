import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginReactCompiler from 'eslint-plugin-react-compiler';

import { fixupPluginRules } from '@eslint/compat';

import tsParser from '@typescript-eslint/parser';

/** @type {import('eslint').Linter.Config[]} */
export default [
    { ignores: ['node_modules/*', 'supabase/*', 'scripts/*'] },

    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    pluginReact.configs.flat.recommended,

    {
        plugins: {
            'react-hooks': fixupPluginRules(pluginReactHooks),
            'react-compiler': pluginReactCompiler,
        },
        rules: {
            ...pluginReactHooks.configs.recommended.rules,
            'react-compiler/react-compiler': 'error',
        },
    },

    {
        languageOptions: {
            globals: {
                ...globals.browser,
            },

            parser: tsParser,
            ecmaVersion: 'latest',
            sourceType: 'module',
        },
    },

    {
        settings: {
            react: {
                version: 'detect', // Automatically detect the React version
            },
        },
    },

    {
        rules: {
            'react/no-unescaped-entities': 0,
            'react/react-in-jsx-scope': 0,
            '@typescript-eslint/semi': 0,
            'block-spacing': 0,
            'quote-props': 0,
            'max-len': 0,
            '@typescript-eslint/space-before-blocks': 0,
            'arrow-spacing': 0,
            'jsx-quotes': 0,
            'no-console': 0,
            'react/jsx-closing-tag-location': 0,
            'no-trailing-spaces': 0,
            'react/jsx-wrap-multilines': 0,
            '@typescript-eslint/no-explicit-any': 0,
            '@typescript-eslint/comma-dangle': 0,
            'import/order': 0,
            'nonblock-statement-body-position': 0,
            'react/function-component-definition': 0,
            'react/jsx-props-no-spreading': 0,
            '@typescript-eslint/no-empty-function': 0,
            'operator-linebreak': 0,
            'import/prefer-default-export': 0,
            '@typescript-eslint/indent': 0,
            'object-property-newline': 0,
            '@typescript-eslint/quotes': 0,
            '@typescript-eslint/space-infix-ops': 0,
            'react/require-default-props': 0,
            'no-underscore-dangle': 0,
            'prefer-promise-reject-errors': 0,
            'no-multiple-empty-lines': 0,
            'key-spacing': 0,
            '@typescript-eslint/object-curly-spacing': 0,
            '@typescript-eslint/brace-style': 0,
            'object-curly-newline': 0,
            'no-multi-spaces': 0,
            curly: [0, 'multi-line'],
            'padded-blocks': 0,
            '@typescript-eslint/naming-convention': 0,
            'prefer-destructuring': 0,
            'react/jsx-one-expression-per-line': 0,
            'react/destructuring-assignment': 0,
            '@typescript-eslint/ban-ts-comment': 0,
            'react/jsx-indent': 0,
            'no-restricted-syntax': 0,
            'no-prototype-builtins': 0,
            'space-in-parens': 0,

            'no-param-reassign': [
                2,
                {
                    props: true,
                    ignorePropertyModificationsForRegex: ['^acc', '^draft'],
                },
            ],

            'function-paren-newline': 0,
            'react/prop-types': 0,
            'prefer-template': 0,
            'no-nested-ternary': 0,
            'no-use-before-define': 0,

            '@typescript-eslint/no-use-before-define': 0,

            'react/jsx-no-useless-fragment': [
                2,
                {
                    allowExpressions: true,
                },
            ],

            'no-empty': [
                1,
                {
                    allowEmptyCatch: true,
                },
            ],

            'no-unused-vars': 0,

            '@typescript-eslint/no-unused-vars': [
                1,
                {
                    vars: 'all',
                    args: 'after-used',
                    ignoreRestSiblings: true,
                    argsIgnorePattern: '^_.*',
                    varsIgnorePattern: '^_.*',
                    destructuredArrayIgnorePattern: '^_.*',
                    caughtErrors: 'none',
                },
            ],

            '@typescript-eslint/comma-spacing': 0,
            'implicit-arrow-linebreak': 0,
            'eol-last': 0,
            '@typescript-eslint/keyword-spacing': 0,
            'react/forbid-prop-types': 0,
            '@typescript-eslint/space-before-function-paren': 0,
            'react/jsx-equals-spacing': 0,
            'react/jsx-props-no-multi-spaces': 0,
            'react/jsx-indent-props': 0,
            'react/jsx-closing-bracket-location': 0,
            'arrow-parens': 0,
            'react/jsx-tag-spacing': 0,
            'react/jsx-max-props-per-line': 0,
            'react/jsx-first-prop-new-line': 0,
            'arrow-body-style': 0,
            'no-spaced-func': 0,
            '@typescript-eslint/func-call-spacing': 0,
            'computed-property-spacing': 0,
            'prefer-arrow-callback': 0,
            'no-whitespace-before-property': 0,
            'no-tabs': 0,
            'no-confusing-arrow': 0,
            'react/jsx-curly-newline': 0,
        },
    },
];
