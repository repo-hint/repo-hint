/**
 * @class PRInfo
 * Providing the interface to get any infomation from GitHub,
 * the instance will cache the information when getting it from GitHub API.
 * What's more, Additional information can mount on the instance.
 */

const { execSync } = require('child_process');
const GitHubAPI = require('./github-api');
const diff = require('parse-diff');

class PRInfo {
	/**
	 * @param {string} number Pull Request Number
	 * @param {any} initialData Pull Request Basic Information
	 */
	constructor (number, initialData, options) {
		this.number = number; // Pull Request Number
		if (initialData && typeof initialData === 'object') {
			Object.assign(this, initialData);
		}
		if (options && typeof options === 'object') {
			this.api = new GitHubAPI({repo: options['REPO'], userAgent: options['USER_AGENT'], token: options['TOKEN']});

			this.codeDir = options['CODE_DIR']; // Code Directory In CI Machine
			this.baseBranch = options['BASE_BRANCH']; // Base Branch of git
		}
	}

	/**
	 * Mount infomation to PRInfo Instance
	 * @param {string} property
	 * @param {any} data
	 */
	set (property, data) {
		this[property] = data;
	}

	/**
	 * Private Method
	 * Get data from GitHub API and store inside the object
	 * @param {string} property
	 */
	async _get (property) {
		switch (property) {
		/* Indicate A PR is merged */
		case 'isMerged':
			this.set('isMerged', await this.api.getPRMergeStatus(this.number));
			break;

		/* display edited */
		case 'files':
			let files = await this.api.getPRFiles(this.number);
			this.set('files', files.map(file => file['filename'])); // only load the filenames
			break;

		/* show reviews record */
		case 'reviews': {
			let info = await this.api.getPRReviews(this.number);
			this.set('reviews', info.map(r => ({
				state: r.state, // {COMMENTED | APPROVED | CHANGES_REQUESTED | PENDING}
				user: r.user.login
			})));
		} break;

		/* Basic Information */
		case 'title':
		case 'state':
		case 'description':
		case 'author':
		case 'assignee':
		case 'assignees':
		case 'requestedReviewers':
		case 'deletions':
		case 'additions': {
			let info = await this.api.getPRInfo(this.number);
			this.set('title', info.title);
			this.set('state', info.state);
			this.set('description', info.body);
			this.set('author', info.user.login);
			this.set('assignee', info.assignee ? info.assignee.login : null);
			this.set('assignees', info.assignees.map(user => user.login));
			this.set('requestedReviewers', info.requested_reviewers.map(user => user.login));
			this.set('deletions', info.deletions);
			this.set('additions', info.additions);
		} break;

		case 'diff': {
			let diffFiles = [];
			// if we can access the git directory, we can use git diff to get diff result instead of getting them from GitHub API
			if (this.codeDir && this.baseBranch) {
				let stdout = execSync(`cd ${this.codeDir} && git diff ${this.baseBranch}`, {encoding: 'utf-8'});
				diffFiles = diff(stdout);
			} else {
				let diffText = await this.api.getPRDiff(this.number);
				diffFiles = diff(diffText);
			}
			diffFiles = diffFiles
				.map(({to: fileName, chunks}) => ({fileName, chunks})) // only get the fields we need
				.map(({fileName, chunks}) => {
					// there are many chunks in a file, but it is not necessary when we are dealing the changes
					let changes = [].concat.apply([], chunks.map(
						({changes}) => changes
					)); // flatten array
					return {fileName, changes};
				});
			this.set('diff', diffFiles);
		} break;
		}
	}

	/**
	 * Obtain the information of the Pull Request
	 * @param {string} property
	 * @returns {any} data
	 */
	async get (property) {
		if (!this[property]) {
			await this._get(property);
		}
		return this[property];
	}
}

module.exports = PRInfo;
