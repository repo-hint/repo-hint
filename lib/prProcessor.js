/**
 * Note that processing a PR with a specific rule is not simply checking,
 * There are some pre-operations or after-operations, which means there is a lifecycle during the
 */
const fs = require('fs');
const path = require('path');
const { spawnSync, execSync } = require('child_process');

// temp directory of temprary storage
const TEMP_DIR = path.join(__dirname, 'tmp');

/**
 * @class PRProcessor
 * A framework to handle the lifecycle of a processing rule
 */
class PRProcessor {
	/**
	 * Initial the PR Processor proerties
	 * @param {any} PRInfo
	 * @param {string} name
	 * @param {boolean} commentOnce
	 * @param {function} main
	 */
	constructor (PRInfo, {
		name,
		main,
		commentOnce
	}) {
		// Property 'main' should be a function
		if (!main || typeof main !== 'function') throw new Error('Invalid process function of Rule!');
		// if the rule will comment only once, the checked history should be saved while it needs a name
		if (commentOnce && !name) throw new Error('The name of rule should be given in order to record ths checked history');

		this.PRInfo = PRInfo;
		this.name = name;
		this.commentOnce = commentOnce;
		this.main = main;
	}

	/**
	 * Main execution function
	 * @param {any} config
	 * @field {string} comments
	 * @field {string} passed
	 */
	async exec (config) {
		let disableCommentOnce = config ? config.disableCommentOnce : false;
		let {comments, passed} = await this.main(this.PRInfo);

		if (this.commentOnce && comments && !disableCommentOnce) {
			const isChecked = this.inspectLogFile(TEMP_DIR, this.name);
			if (isChecked) comments = ''; // set to empty string so no comment will be sent
		}
		return {comments, passed};
	}

	/**
	 * Check whether the PR is processed by the rule
	 * @param {string} directory
	 * @param {string} ruleName
	 * @returns {boolean} checking status of the specific rule
	 */
	inspectLogFile (directory, ruleName) {
		if (this.checkTempDirectoryAvailable(directory)) {
			const {number} = this.PRInfo;
			const logFile = path.join(directory, `${ruleName}-checked`);
			// check whether the file exist
			if (!fs.existsSync(logFile)) {
				execSync(`echo ${number} >> ${logFile}`);
				return false;
			} else {
				const {status} = spawnSync('grep', ['-c', number, logFile]);
				// unable to find record, which means the PR is unchecked
				if (status !== 0) {
					execSync(`echo ${number} >> ${logFile}`);
					return false;
				} else return true;
			}
		}
		return false;
	}

	/**
	 * Inspect whether the temp directory can be used
	 * @param {string} filePath
	 * @returns {boolean}
	 */
	checkTempDirectoryAvailable (filePath) {
		if (!filePath) throw new Error('Path is required');
		if (!fs.existsSync(filePath)) {
			try {
				fs.mkdirSync(filePath);
			} catch (e) {
				console.error(e);
				return false;
			}
		} else {
			const stats = fs.statSync(filePath);
			if (!stats.isDirectory()) {
				console.error('Unable to save checked Logs!');
				return false;
			}
		}
		return true;
	}
}

module.exports = PRProcessor;