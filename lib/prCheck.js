/**
 * Entrance File
 * Run from command line and receive several parameters
 */

const fs = require('fs');
const path = require('path');
const PRInfo = require('./prInfo');
const PRProcessor = require('./prProcessor');

const GitHubAPI = require('./github-api');

let rules = {
	preProcessors: [],
	codeRules: [],
	criterionRules: []
};
let disableComment = false; // disable comment on Pull Request
let api = null;
let processorConfig = {};

/**
 * Main Function
 * @param {string | number} number Pull Request Number
 * @param {string} sha1 Pull Request SHA1
 * @param {string} author Pull Request Author
 * @param {string} title Pull Request Title
 * @param {string} description Pull Request Description
 * @param {string[]} files array of file path
 * @param {string} configFolderPath
 * @param {any} options
 */
async function prCheck ({number, sha1, author, title, description, files}, configFolderPath, options) {
	// Jenkins sync git code abnormally
	if (sha1 && !/origin\/pr/.test(sha1)) { return; }

	// set default temp directory
	processorConfig['TEMP_DIR'] = configFolderPath;

	let config = loadConfiguration(configFolderPath);
	api = new GitHubAPI({repo: config['REPO'], userAgent: config['USER_AGENT'], token: config['TOKEN']});

	let initialPRInfo = {author, title, description, files};
	const prInfo = new PRInfo(number, initialPRInfo, config);

	if (!options) {
		await processCodeRule(prInfo);
		await processCriterionRule(prInfo, config);
	} else {
		if (options['codeRules'] && options['codeRules']['on']) {
			await processCodeRule(prInfo, {
				disableCommentOnce: options['codeRules']['disableCommentOnce']
			});
		}
		if (options['criterionRules'] && options['criterionRules']['on']) {
			await processCriterionRule(prInfo, config, {
				disableCommentOnce: options['criterionRules']['disableCommentOnce']
			});
		}
	}
};

module.exports = prCheck;

/**
 * Check the Pull Request with Rules corresponding with code review
 * @param {any} prInfo
 * @param {any} options
 */
async function processCodeRule (prInfo, options) {
	const {number} = prInfo;
	let state = true; // PR Check pass or not
	// preprocess the Pull Request Information
	rules.preProcessors.forEach(preProcessor => preProcessor(prInfo));

	// process each rule on the Pull Request
	for (let rule of rules.codeRules) {
		const processor = new PRProcessor(prInfo, rule, processorConfig);
		const {comments, passed} = await processor.exec(options);
		// fail passing the rule
		if (passed === false) { state = false; }

		// send comment
		if (comments) { api.addCommentOnPR(number, comments); }
	}

	await api.setPRStatus(number, state ? 'success' : 'failure', 'PR Check', '', state ? 'PR 规则校验通过' : '未通过 PR 规则校验');
}

/**
 * Check the Pull Request with Rules corresponding with criterion
 * @param {any} prInfo
 * @param {any} options
 */
async function processCriterionRule (prInfo, config, options) {
	const {number} = prInfo;
	const {SECRET_KEY, HOST, PROTOCOL, PORT} = config;
	let state = true;
	let commentContent = [];
	// process each rule on the Pull Request
	for (let rule of rules.criterionRules) {
		const processor = new PRProcessor(prInfo, rule, processorConfig);
		const {comments, passed} = await processor.exec(options);
		// fail passing the rule
		if (passed === false) { state = false; }

		// comment will be sent
		if (comments) { commentContent.push(comments); }
	}

	let targetUrl = '';
	if (!state && commentContent.length > 0) {
		const crypto = require('crypto');
		let hmac = crypto.createHmac('sha256', SECRET_KEY);
		hmac.update(number);
		let code = hmac.digest('hex');

		targetUrl = `${PROTOCOL}://${HOST}${PORT ? `:${PORT}` : ''}/api/pr/check?pr=${number}&token=${code}`;
		commentContent.push(`点击 [此处](${targetUrl}) 重新检查 PR 标题和描述 \n\n`);
		console.log(`#${number} failed passing PRInfo Inspection`);
	}

	if (commentContent.length > 0) {
		api.addCommentOnPR(number, commentContent.join('\n'));
	}
	await api.setPRStatus(number, state ? 'success' : 'failure', 'PRInfo Inspection', targetUrl, state ? '标题描述符合规范' : '标题描述不符合规范');
}

/**
 * load configuration file and checking rules
 * @param {string} configFolderPath
 * @returns {any}
 */
function loadConfiguration (configFolderPath) {
	rules.codeRules = require(path.join(configFolderPath, 'repo-hint-rules', 'rules-code'));
	rules.criterionRules = require(path.join(configFolderPath, 'repo-hint-rules', 'rules-criterion'));
	rules.preProcessors = require(path.join(configFolderPath, 'repo-hint-rules', 'preprocessors'));

	let config = fs.readFileSync(path.join(configFolderPath, 'config.json'));
	try {
		config = JSON.parse(config);
	} catch (e) {
		console.error('Failed Reading Configuration');
		process.exit(1);
	}
	return config;
}
