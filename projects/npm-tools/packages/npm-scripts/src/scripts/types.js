/**
 * SPDX-FileCopyrightText: © 2019 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: BSD-3-Clause
 */

const path = require('path');

const getTypeScriptBuildOrder = require('../typescript/getTypeScriptBuildOrder');
const getTypeScriptDependencyGraph = require('../typescript/getTypeScriptDependencyGraph');
const runTSC = require('../typescript/runTSC');
const findRoot = require('../utils/findRoot');
const log = require('../utils/log');

function types() {
	const cwd = process.cwd();
	const root = findRoot();

	if (root && root !== cwd) {
		log(
			'You ran "liferay-npm-scripts types" from:',
			'',
			`    ${path.relative(root, process.cwd())}`,
			'',
			'But generating types is a global process; will run from:',
			'',
			`    ${root}`,
			''
		);
	}

	const graph = getTypeScriptDependencyGraph();

	const projects = getTypeScriptBuildOrder(graph);

	for (let i = 0; i < projects.length; i++) {
		const {directory, name} = projects[i];

		log(`Generating types (${i + 1} of ${projects.length}): ${name}`);

		try {
			process.chdir(directory);

			runTSC();
		}
		finally {
			process.chdir(cwd);
		}
	}
}

module.exports = types;
