#!/usr/bin/env node

'use strict';

process.once('uncaughtException', err => {
	console.error(err.message);
	console.error(err.stack);
	process.exitCode = 1;
});

const program = require('commander');
const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_NAME = 'repo-hint';

program
	.version('0.1.1')
	.command('init')
	.description('Initialize configuration')
	.action(function () {
		const initialConfig = require('../lib/command/initialize');
		initialConfig()
			.then(() => {
				process.exitCode = 0;
			})
			.catch(err => {
				process.exitCode = 1;
				console.error(err.message);
				console.error(err.stack);
			});
	});

program
	.command('server <command>')
	.description('Manipulate the web server')
	.option('-c, --config [path]', 'configuration file path')
	.action(function (command, options) {
		const pm2 = require('pm2');

		pm2.connect(function (err) {
			if (err) {
				console.error(err);
				process.exit(2);
			}

			switch (command) {
			case 'start':
				const config = options.config ? options.config : process.cwd();
				pm2.start({
					name: APP_NAME,
					script: path.join(__dirname, '..', 'lib', 'server.js'),
					args: [config],
					max_memory_restart: '100M'
				}, function (err, apps) {
					pm2.disconnect();
					if (err) throw err;
				});
				break;
			case 'stop':
				pm2.delete(APP_NAME, function (err) {
					pm2.disconnect();
					if (err) throw err;
				});
				break;
			case 'restart':
				pm2.restart(APP_NAME, function (err) {
					pm2.disconnect();
					if (err) throw (err);
				});
				break;
			}
		});
	}).on('--help', function () {
		console.log('');
		console.log('  Examples:');
		console.log();
		console.log('    $ repo-hint server [options] start');
		console.log('    $ repo-hint server stop');
		console.log('    $ repo-hint server restart');
		console.log();
	});

program
	.command('bot <command> [args...]')
	.description('Command Line Interface for GitHub API')
	.option('-c, --config [path]', 'configuration file path')
	.action(function (command, args, options) {
		const config = parseConfigFile(options.config);
		if (!config) { process.exit(1); }
		const cli = require('../lib/cli');
		cli(command, args, config);
	}).on('--help', function () {
		console.log();
		console.log('  Command: ');
		console.log(`
    comment:list   $PRNumber
    comment:add    $PRNumber $content
    comment:delete $commentID
    pr:info        $PRNumber
    pr:file        $PRNumber
    pr:isMerged    $PRNumber
    pr:update      $PRNumber $state {open | closed}
    pr:status      $PRNumber
    pr:status:set  $PRNumber $status $context $targetUrl $description
`);
	});

program
	.command('exec [args...]')
	.description('Check Pull Request')
	.option('-c, --config [path]', 'configuration file path')
	.action(function (args, options) {
		const config = options.config ? options.config : process.cwd();

		let files = null;
		let {ghprbPullId, sha1, ghprbPullAuthorLogin, ghprbPullTitle, ghprbPullLongDescription} = process.env;
		if (args.length > 0) {
			[ghprbPullId, sha1, ghprbPullAuthorLogin, ghprbPullTitle, ghprbPullLongDescription, ...files] = args;
			if (files && files.length <= 0) files = null;
		}

		// TODO: for debug
		console.log(
			JSON.stringify({
				ghprbPullId, sha1, ghprbPullAuthorLogin, ghprbPullTitle, ghprbPullLongDescription, files
			}, null, 2)
		);

		const prCheck = require('../lib/prCheck');
		prCheck({
			number: ghprbPullId,
			sha1: sha1,
			author: ghprbPullAuthorLogin,
			title: ghprbPullTitle,
			description: ghprbPullLongDescription,
			files: files
		}, config).then(() => {
			process.exitCode = 0;
		}).catch(err => {
			process.exitCode = 1;
			console.error(err.message);
			console.error(err.stack);
		});
	});

program.parse(process.argv);

if (!process.argv.slice(2).length) {
	program.outputHelp();
}

/**
 * read & parse configuration file
 * @param {string} filePath
 * @returns {object | boolean}
 */
function parseConfigFile (filePath) {
	// try find config file
	if (!filePath) {
		filePath = path.join(process.cwd(), 'config.json');
	}
	if (!filePath.endsWith('.json')) {
		filePath = path.join(filePath, 'config.json');
	}
	// parse JSON config file
	let config = null;
	try {
		const file = fs.readFileSync(filePath, {encoding: 'utf8'});
		config = JSON.parse(file);
	} catch (e) {
		console.error(e);
		return false;
	}
	// check configuration
	if (!(config['REPO'] && config['USER_AGENT'] && config['TOKEN'])) {
		console.error('Configuration Error.');
		return false;
	}
	return config;
}
