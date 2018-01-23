/**
 * @fileoverview A simple CLI for configure repohint
 */

const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');

async function initialConfig () {
	let config = await promptUser();

	console.log(JSON.stringify(config, null, 2));

	const {ok} = await inquirer.prompt([{
		type: 'confirm',
		name: 'ok',
		message: 'It is ok?',
		default: true
	}]);

	if (!ok) { return; }

	const [SECRET_KEY, USER_AGENT] = config.REPO.split('/');
	Object.assign(config, {SECRET_KEY, USER_AGENT});

	const folder = 'repohint-rules';
	try {
		fs.mkdirSync(folder);
	} catch (e) {
		console.error(new Error('Fail to create directory.'));
		process.exit(1);
	}

	console.log('Copying files...');
	['preprocessors', 'rules-code', 'rules-criterion'].forEach(subFolder => {
		copyFilesRecursivelySync(path.join(__dirname, '..', subFolder), path.join(process.cwd(), folder, subFolder));
	});
	fs.writeFileSync(path.join(process.cwd(), 'config.json'), JSON.stringify(config, null, 2), {encoding: 'utf8', flag: 'w'});

	const PWD = execSync('pwd', {encoding: 'utf8'}).replace(/\n/g, '');

	console.log(`Please use this command to start the server
$ repohint server start -c ${PWD}
If you want the server start automatically after the rebooting of the machine, please use '$pm2 save' and '$pm2 startup'.
`);

	console.log(`By the way, you can modified the configuration in the "config.json" at any time.
Remember to use '$pm2 reload repo-hint' to reload the server after changing the configuration if you had created a server.`);
};

/**
 * Basic Configuration
 * @returns Promise<any>
 */
function promptUser () {
	return inquirer.prompt([
		{
			type: 'input',
			name: 'REPO',
			message: 'What\'s your GitHub Repository Name and Ownership?',
			default: 'repo-hint/repo-hint',
			validate: function (input) {
				return new Promise(function (resolve, reject) {
					if (!/[a-zA-Z0-9]*\/[a-zA-Z0-9]*/.test(input)) {
						resolve('Invalid Repository Name and Ownership');
					}
					resolve(true);
				});
			}
		},
		{
			type: 'input',
			name: 'TOKEN',
			message: 'Please input your GitHub Personal Access Tokens (To access this repo using GitHub API)',
			default: '0000000000000000000000000000000000000000'
		},
		{
			type: 'input',
			name: 'HOST',
			message: 'Please input your hostname of the server with which can be accessed from Internet',
			default: 'www.example.com'
		},
		{
			type: 'list',
			name: 'PROTOCOL',
			message: 'Which protocol do you use ?',
			default: 'http',
			choices: [
				{name: 'http', value: 'http'},
				{name: 'https', value: 'https'}
			]
		},
		{
			type: 'input',
			name: 'PORT',
			message: 'Which port can be used accessing from Internet?',
			default: '80'
		},
		{
			type: 'input',
			name: 'SERVER_PORT',
			message: 'Which port can be used to create a server? (You may use nginx or other proxy server)',
			default: '8100'
		}
	]);
}

/**
 * Copy File Recursively
 * @param {string} src
 * @param {string} dest
 */
function copyFilesRecursivelySync (src, dest) {
	const stat = fs.statSync(src);
	if (stat.isDirectory()) {
		const fileList = fs.readdirSync(src);
		if (!fs.existsSync(dest)) fs.mkdirSync(dest);
		fileList.forEach(file => copyFilesRecursivelySync(path.join(src, file), path.join(dest, file)));
	} else {
		fs.copyFileSync(src, dest);
	}
}

module.exports = initialConfig;
