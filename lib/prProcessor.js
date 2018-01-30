/**
 * Note that processing a PR with a specific rule is not simply checking,
 * There are some pre-operations or after-operations, which means there is a lifecycle during the
 */
const fs = require('fs');
const path = require('path');
const { spawnSync, execSync } = require('child_process');

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
	}, {TEMP_DIR}) {
		// Property 'main' should be a function
		if (!main || typeof main !== 'function') throw new Error('Invalid process function of Rule!');
		// if the rule will comment only once, the checked history should be saved while it needs a name
		if (commentOnce && !name) throw new Error('The name of rule should be given in order to record ths checked history');

		this.PRInfo = PRInfo;
		this.name = name;
		this.commentOnce = commentOnce;
		this.main = main;

		// temp directory of temprary storage
		this.temp_dir = path.join(TEMP_DIR, 'tmp');
	}

	/**
	 * Main execution function
	 * @param {any} config
	 * @field {string} comments
	 * @field {string} passed
	 */
	async exec (config) {
		let disableCommentOnce = config ? config.disableCommentOnce : false;
		let {comments, passed, labels} = await this.main(this.PRInfo);

		if (this.commentOnce && comments && !disableCommentOnce) {
			const isChecked = this.inspectLogFile(this.temp_dir, this.name, labels);
			if (isChecked) comments = ''; // set to empty string so no comment will be sent
		}
		return {comments, passed};
	}

	/**
	 * Check whether the PR is processed by the rule
	 * @param {string} directory
	 * @param {string} ruleName
	 * @param {string | string[]} labels
	 * @returns {boolean} checking status of the specific rule
	 */
	inspectLogFile (directory, ruleName, labels) {
		if (this.checkTempDirectoryAvailable(directory)) {
			const {number} = this.PRInfo;
			const logFile = path.join(directory, `${ruleName}-checked`);

			let labelText = '';
			if (!labels) {
				labelText = `${number}`;
			} else if (typeof labels === 'string') {
				labelText = `${number}:${labels}`;
			} else if (Array.isArray(labels)) {
				labelText = '"' + labels.map(label => `${number}:${label}`).join('\n') + '"';
			}

			// check whether the file exist
			if (!fs.existsSync(logFile)) {
				execSync(`echo ${labelText} >> ${logFile}`);
				return false;
			} else {
				let isChecked = false;
				if (!labels || typeof labels === 'string') {
					const {status} = spawnSync('grep', ['-c', labelText, logFile]);
					if (status === 0) {
						isChecked = true;
					}
				} else if (Array.isArray(labels)) {
					isChecked = labels.map(label => `${number}:${label}`).map(line => {
						const {status} = spawnSync('grep', ['-c', line, logFile]);
						return status;
					}).every(status => status === 0);
				}
				// unable to find record, which means the PR is unchecked
				if (!isChecked) {
					// Warnning ! This line of shell code do not support Windows CMD
					execSync(`echo ${labelText} >> ${logFile}`);
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
