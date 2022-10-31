/**
 * SPDX-FileCopyrightText: © 2019 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: BSD-3-Clause
 */

/* eslint-disable @liferay/no-dynamic-require */

const path = require('path');
const resolve = require('resolve');
const TerserPlugin = require('terser-webpack-plugin');

const convertImportsToExternals = require('./convertImportsToExternals');
const createTempFile = require('./createTempFile');
const flattenPkgName = require('./flattenPkgName');
const runWebpack = require('./runWebpack');

/**
 * Runs webpack as a replacement of the bundler
 */
module.exports = async function runWebpackAsBundler(
	projectDir,
	buildConfig,
	babelConfig
) {
	const start = Date.now();

	const indexWebpackConfig = getIndexWebpackConfig(
		projectDir,
		buildConfig,
		babelConfig
	);

	if (indexWebpackConfig) {
		createTempFile(
			`webpackAsBundler.index.config.json`,
			JSON.stringify(indexWebpackConfig, null, 2),
			{autoDelete: false}
		);

		await runWebpack(indexWebpackConfig, buildConfig.report);
	}

	const webpackConfigs = getImportsWebpackConfigs(buildConfig);

	let i = 0;

	for (const webpackConfig of webpackConfigs) {
		createTempFile(
			`webpackAsBundler.import[${i++}].config.json`,
			JSON.stringify(webpackConfig, null, 2),
			{autoDelete: false}
		);

		await runWebpack(webpackConfig, buildConfig.report);
	}

	const lapse = Math.floor((Date.now() - start) / 1000);

	/* eslint-disable-next-line no-console */
	console.log(`ESM bundling took ${lapse}s`);
};

function getIndexWebpackConfig(projectDir, buildConfig, babelConfig) {
	if (!buildConfig.main) {
		return;
	}

	const mainFilePath = path.resolve(projectDir, buildConfig.main);

	const {imports} = buildConfig;
	const externals = convertImportsToExternals(imports, 2);

	const webpackConfig = {
		entry: {
			[`__liferay__/index`]: {
				import: mainFilePath,
			},
		},
		experiments: {
			outputModule: true,
		},
		externals,
		externalsType: 'module',
		module: {
			rules: [
				{
					exclude: /node_modules/,
					test: /\.jsx?$/,
					use: {
						loader: require.resolve('babel-loader'),
						options: babelConfig,
					},
				},
				{
					exclude: /node_modules/,
					test: /\.scss$/,
					use: [
						{
							loader: require.resolve('./webpackScssLoader'),
							options: {
								buildConfig,
								projectDir,
							},
						},
					],
				},
				{
					exclude: /node_modules/,
					test: /\.tsx?/,
					use: {
						loader: require.resolve('babel-loader'),
						options: babelConfig,
					},
				},
			],
		},
		optimization: {
			minimize: true,
			minimizer: [
				new TerserPlugin({
					terserOptions: {
						keep_classnames: true,
						keep_fnames: true,
					},
				}),
			],
		},
		output: {
			environment: {
				dynamicImport: true,
				module: true,
			},
			filename: '[name].js',
			library: {
				type: 'module',
			},
			path: path.resolve(buildConfig.output),
		},
		plugins: [],
		resolve: {
			extensions: ['.js', '.jsx', '.ts', '.tsx'],
			fallback: {
				path: false,
			},
		},
	};

	if (process.env.NODE_ENV === 'development') {
		webpackConfig.devtool = 'cheap-source-map';
		webpackConfig.mode = 'development';
	}
	else {
		webpackConfig.devtool = false;
		webpackConfig.mode = 'production';
	}

	return webpackConfig;
}

function getEntryImportDescriptor(exportsItem) {
	const pkgName = exportsItem.name;
	const flatPkgName = flattenPkgName(pkgName);

	let importPath;

	if (exportsItem.symbols === undefined) {
		importPath = pkgName;
	}
	else {
		let module;

		if (exportsItem.symbols === 'auto') {
			try {
				module = require(resolve.sync(pkgName, {basedir: '.'}));
			}
			catch (error) {
				console.error('');
				console.error(
					`Unable to require('${pkgName}'): please consider specifying`,
					`the exported symbols explicitly in your`,
					`'npmscripts.config.js' file.`
				);
				console.error('');
				console.error(error);

				process.exit(1);
			}
		}
		else {
			module = exportsItem.symbols.reduce((module, symbol) => {
				module[symbol] = true;

				return module;
			}, {});

			if (exportsItem.format === 'esm') {
				module.__esModule = true;
			}
		}

		const nonDefaultFields = Object.keys(module)
			.filter((field) => field !== 'default')
			.map((field) => `	${field}`)
			.join(',\n');

		let bridgeSource;

		//
		// If the exported object was generated by a harmony aware tool, we
		// directly export the fields as is.
		//
		// Otherwise, we need to set default to the exported object so that
		// other modules can find it when they are interoperated by tools like
		// babel or webpack.
		//

		if (module.__esModule) {
			bridgeSource = `
const x = require('${pkgName}');

const {
	default: def,
${nonDefaultFields}
} = x;

export {
	def as default,
${nonDefaultFields}
};
`;
		}
		else {
			bridgeSource = `
const x = require('${pkgName}');

const {
${nonDefaultFields}
} = x;

const __esModule = true;

export {
	__esModule,
	x as default,
${nonDefaultFields}
};
`;
		}

		const {filePath} = createTempFile(`${flatPkgName}.js`, bridgeSource, {
			autoDelete: false,
		});

		importPath = filePath;
	}

	return {
		flatPkgName,
		importPath,
		pkgName,
	};
}

function getImportsWebpackConfigs(buildConfig) {
	const {exports, imports} = buildConfig;

	const allExternals = convertImportsToExternals(imports, 3);

	return exports.reduce((webpackConfigs, exportsItem) => {
		const {flatPkgName, importPath, pkgName} = getEntryImportDescriptor(
			exportsItem
		);

		const externals = {
			...allExternals,
		};

		delete externals[pkgName];

		const webpackConfig = {
			entry: {
				[`__liferay__/exports/${flatPkgName}`]: {
					import: importPath,
				},
			},
			experiments: {
				outputModule: true,
			},
			externals,
			externalsType: 'module',
			module: {
				rules: [
					{
						exclude: /node_modules/,
						test: /\.js$/,
						use: {
							loader: require.resolve('babel-loader'),
							options: {
								presets: [
									require.resolve('@babel/preset-env'),
									require.resolve('@babel/preset-react'),
								],
							},
						},
					},
				],
			},
			optimization: {
				minimize: true,
				minimizer: [
					new TerserPlugin({
						terserOptions: {
							keep_classnames: true,
							keep_fnames: true,
						},
					}),
				],
			},
			output: {
				environment: {
					dynamicImport: true,
					module: true,
				},
				filename: '[name].js',
				library: {
					type: 'module',
				},
				path: path.resolve(buildConfig.output),
			},
			resolve: {
				fallback: {
					path: false,
				},
			},
		};

		if (process.env.NODE_ENV === 'development') {
			webpackConfig.devtool = 'cheap-source-map';
			webpackConfig.mode = 'development';
		}
		else {
			webpackConfig.devtool = false;
			webpackConfig.mode = 'production';
		}

		if (buildConfig.report) {
			createTempFile(
				`${flatPkgName}.webpack.config.json`,
				JSON.stringify(webpackConfig, null, 2),
				{autoDelete: false}
			);
		}

		webpackConfigs.push(webpackConfig);

		return webpackConfigs;
	}, []);
}
