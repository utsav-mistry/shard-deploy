'use strict';

const fs = require('fs');
const path = require('path');

const FAILURE_MESSAGE = [
    '❌ Could not determine how to start your app.',
    '',
    'Please ensure one of the following exists:',
    '- a "start" script in package.json',
    '- a "main" field in package.json',
    '- an index.js file',
].join('\n');

function readPackageJson(projectRoot) {
    const packageJsonPath = path.join(projectRoot, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
        return null;
    }

    try {
        const raw = fs.readFileSync(packageJsonPath, 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function formatCommandLabel(command) {
    return command.join(' ');
}

function normalizeMainField(mainField) {
    return mainField.replace(/^\.\//, '');
}

function fileExists(projectRoot, relativeFilePath) {
    return fs.existsSync(path.join(projectRoot, relativeFilePath));
}

function detectEntrypoint(projectRoot = process.cwd()) {
    const pkg = readPackageJson(projectRoot);

    if (!pkg) {
        throw new Error(FAILURE_MESSAGE);
    }

    if (pkg.scripts && typeof pkg.scripts.start === 'string' && pkg.scripts.start.trim()) {
        return {
            type: 'npm',
            command: ['npm', 'start'],
            label: 'npm start',
        };
    }

    if (typeof pkg.main === 'string' && pkg.main.trim()) {
        const mainFile = normalizeMainField(pkg.main.trim());

        if (fileExists(projectRoot, mainFile)) {
            const command = ['node', mainFile];
            return {
                type: 'node',
                command,
                label: formatCommandLabel(command),
            };
        }
    }

    if (fileExists(projectRoot, 'index.js')) {
        return {
            type: 'node',
            command: ['node', 'index.js'],
            label: 'node index.js',
        };
    }

    throw new Error(FAILURE_MESSAGE);
}

module.exports = {
    detectEntrypoint,
    FAILURE_MESSAGE,
};