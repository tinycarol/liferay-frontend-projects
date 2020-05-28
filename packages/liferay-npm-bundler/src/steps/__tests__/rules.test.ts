/**
 * SPDX-FileCopyrightText: © 2017 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import {
	BundlerLoaderContext,
	FilePath,
	PluginLogger,
} from 'liferay-js-toolkit-core';
import path from 'path';

import {project} from '../../globals';
import {stripSourceDir, transformContents} from '../rules';

const savedNativeIsPosix = FilePath.nativeIsPosix;
const savedPathSep = path.sep;
const savedProjectPath = project.dir.asNative;

describe('stripSourceDir', () => {
	beforeEach(() => {
		project.loadFrom(path.join(__dirname, '__fixtures__', 'rules-project'));
	});

	afterEach(() => {
		(FilePath as object)['nativeIsPosix'] = savedNativeIsPosix;
		(path as object)['sep'] = savedPathSep;
		project.loadFrom(savedProjectPath);
	});

	it('works with posix paths', () => {
		(path as object)['sep'] = path.posix.sep;
		(FilePath as object)['nativeIsPosix'] = true;

		expect(stripSourceDir('assets/path/to/file.js')).toEqual(
			'path/to/file.js'
		);

		expect(stripSourceDir('src/main/resources/path/to/file.js')).toEqual(
			'path/to/file.js'
		);
	});

	it('works with win32 paths', () => {
		(path as object)['sep'] = path.win32.sep;
		(FilePath as object)['nativeIsPosix'] = false;

		expect(stripSourceDir('assets\\path\\to\\file.js')).toEqual(
			'path\\to\\file.js'
		);

		expect(
			stripSourceDir('src\\main\\resources\\path\\to\\file.js')
		).toEqual('path\\to\\file.js');
	});
});

describe('transformContents', () => {
	describe('before invocation', () => {
		let context;

		beforeEach(() => {
			context = {
				filePath: 'path/to/a/file',
				content: Buffer.from('sample content', 'utf-8'),
				extraArtifacts: {
					a: Buffer.from('artifact content 1', 'utf-8'),
					b: Buffer.from('artifact content 2', 'utf-8'),
				},
			};
		});

		it('converts Buffers to strings if encoding present', () => {
			transformContents(true, context, 'utf-8');

			expect(typeof context.content).toBe('string');
			expect(typeof context.extraArtifacts['a']).toBe('string');
			expect(typeof context.extraArtifacts['b']).toBe('string');
		});

		it('leaves Buffers untouched if encoding is null', () => {
			transformContents(true, context, null);

			expect(context.content).toBeInstanceOf(Buffer);
			expect(context.extraArtifacts['a']).toBeInstanceOf(Buffer);
			expect(context.extraArtifacts['b']).toBeInstanceOf(Buffer);
		});

		it('throws if content is not a Buffer', () => {
			context.content = context.content.toString('utf-8');

			expect(() => transformContents(true, context, 'utf-8')).toThrow();
		});

		it('throws if any extra artifact is not a Buffer', () => {
			context.extraArtifacts['b'] = context.extraArtifacts['b'].toString(
				'utf-8'
			);

			expect(() => transformContents(true, context, 'utf-8')).toThrow();
		});

		it('ignores undefined content', () => {
			context.content = undefined;

			expect(() => transformContents(true, context, null)).not.toThrow();
			expect(() =>
				transformContents(true, context, 'utf-8')
			).not.toThrow();
		});

		it('ignores undefined extra artifacts', () => {
			context.extraArtifacts['a'] = undefined;
			context.extraArtifacts['b'] = undefined;

			expect(() => transformContents(true, context, null)).not.toThrow();
			expect(() =>
				transformContents(true, context, 'utf-8')
			).not.toThrow();
		});
	});

	describe('after invocation', () => {
		it('converts strings to Buffers if encoding present', () => {
			const context: BundlerLoaderContext<string> = {
				filePath: 'path/to/a/file',
				content: 'sample content',
				extraArtifacts: {
					a: 'artifact content 1',
					b: 'artifact content 2',
				},
				log: new PluginLogger(),
			};

			transformContents(false, context, 'utf-8');

			expect(context.content).toBeInstanceOf(Buffer);
			expect(context.extraArtifacts['a']).toBeInstanceOf(Buffer);
			expect(context.extraArtifacts['b']).toBeInstanceOf(Buffer);
		});

		it('leaves Buffers untouched if encoding is null', () => {
			const context: BundlerLoaderContext<Buffer> = {
				filePath: 'path/to/a/file',
				content: Buffer.from('sample content', 'utf-8'),
				extraArtifacts: {
					a: Buffer.from('artifact content 1', 'utf-8'),
					b: Buffer.from('artifact content 2', 'utf-8'),
				},
				log: new PluginLogger(),
			};

			transformContents(false, context, null);

			expect(context.content).toBeInstanceOf(Buffer);
			expect(context.extraArtifacts['a']).toBeInstanceOf(Buffer);
			expect(context.extraArtifacts['b']).toBeInstanceOf(Buffer);
		});

		it('throws if content is a Buffer and encoding is present', () => {
			const context: BundlerLoaderContext<Buffer> = {
				filePath: 'path/to/a/file',
				content: Buffer.from('sample content', 'utf-8'),
				extraArtifacts: {},
				log: new PluginLogger(),
			};

			expect(() => transformContents(false, context, 'utf-8')).toThrow();
		});

		it('throws if any extra artifact is a Buffer and encoding is present', () => {
			const context: BundlerLoaderContext<string> = {
				filePath: 'path/to/a/file',
				content: 'sample content',
				extraArtifacts: {
					a: Buffer.from('artifact content 1', 'utf-8'),
					b: Buffer.from('artifact content 2', 'utf-8'),
				},
				log: new PluginLogger(),
			};

			expect(() => transformContents(false, context, 'utf-8')).toThrow();
		});

		it('throws if content is a string and encoding is null', () => {
			const context: BundlerLoaderContext<string> = {
				filePath: 'path/to/a/file',
				content: 'sample content',
				extraArtifacts: {},
				log: new PluginLogger(),
			};

			expect(() => transformContents(false, context, null)).toThrow();
		});

		it('throws if any extra artifact is a string and encoding is null', () => {
			const context: BundlerLoaderContext<Buffer> = {
				filePath: 'path/to/a/file',
				content: Buffer.from('sample content', 'utf-8'),
				extraArtifacts: {
					a: 'artifact content 1',
					b: 'artifact content 2',
				},
				log: new PluginLogger(),
			};

			expect(() => transformContents(false, context, null)).toThrow();
		});

		it('ignores undefined content', () => {
			const context: BundlerLoaderContext<string> = {
				filePath: 'path/to/a/file',
				content: undefined,
				extraArtifacts: {},
				log: new PluginLogger(),
			};

			expect(() => transformContents(false, context, null)).not.toThrow();
			expect(() =>
				transformContents(false, context, 'utf-8')
			).not.toThrow();
		});

		it('ignores undefined extra artifacts', () => {
			const context: BundlerLoaderContext<string | Buffer> = {
				filePath: 'path/to/a/file',
				content: 'sample content',
				extraArtifacts: {
					a: undefined,
					b: undefined,
				},
				log: new PluginLogger(),
			};

			expect(() =>
				transformContents(false, context, 'utf-8')
			).not.toThrow();

			context.content = Buffer.from(context.content as string, 'utf-8');
			expect(() => transformContents(false, context, null)).not.toThrow();
		});
	});
});