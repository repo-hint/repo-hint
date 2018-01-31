const https = require('https');

/**
 * @class GitHubAPI
 * A tool to access GitHub Repo Information
 */
class GitHubAPI {
	/**
	 * basic configuration
	 * @param {string} repo
	 * @param {string} userAgent
	 * @param {string} token
	 */
	constructor ({
		repo,
		userAgent,
		token
	}) {
		this._repo = repo;
		this._userAgent = userAgent;
		this._token = token;
	}

	/**
	 * 发送一条 review 评论
	 * @param {string} number PR 序号
	 * @param {string} content 评论内容
	 * @param {string} event review action {APPROVE, REQUEST_CHANGES, COMMENT}
	 */
	async createPRReview (number, content, event = 'COMMENT') {
		if (['APPROVE', 'REQUEST_CHANGES', 'COMMENT'].indexOf(event) === -1) return;
		await this.requestGitHub(`/pulls/${number}/reviews`, 'POST', false, {
			body: content,
			event: event,
			media: '+json'
		});
	}

	/**
	 * 创建一条评论
	 * @param {string} number PR序号
	 * @param {string} content 评论内容
	 */
	async addCommentOnPR (number, content = 'Please be careful with your pull request.') {
		await this.requestGitHub(`/issues/${number}/comments`, 'POST', false, {
			body: content
		});
	}

	/**
	 * 获取单个PR的 comment
	 * @param {string} number PR序号
	 */
	async getPRComments (number) {
		return this.requestGitHub(`/issues/${number}/comments`, 'GET', true);
	}

	/**
	 * 删除一条评论
	 * @param {string} commentId 评论id
	 */
	async deleteAComment (commentId) {
		await this.requestGitHub(`/issues/comments/${commentId}`, 'DELETE', false);
	}

	/**
	 * 获取单个PR的 review 记录
	 * @param {string} number PR序号
	 */
	async getPRReviews (number) {
		return this.requestGitHub(`/pulls/${number}/reviews`, 'GET', true);
	}

	/**
	 * 获取单个PR的 修改过的文件
	 * @param {string} number PR序号
	 */
	async getPRFiles (number) {
		return this.requestGitHub(`/pulls/${number}/files`, 'GET', true);
	}

	/**
	 * 获取单个PR的 diff 结果
	 * @param {string} number PR序号
	 */
	async getPRDiff (number) {
		return this.requestGitHub(`/pulls/${number}.diff`, 'GET', true, null, {media: '.diff'});
	}

	/**
	 * 获取单个PR内容
	 * @param {string} number PR序号
	 */
	async getPRInfo (number) {
		return this.requestGitHub(`/pulls/${number}`, 'GET', true);
	}

	/**
	 * 更新一个PR的状态
	 * @param {string} number PR序号
	 * @param {string} state 状态 打开或关闭
	 */
	async updatePRState (number, state) {
		if (['open', 'closed'].indexOf(state) === -1) {
			throw new Error('Invalid state');
		}
		await this.requestGitHub(`/pulls/${number}`, 'PATCH', false, {state});
	}

	/**
	 * 设置 PR 检查的状态
	 * @param {string} number PR序号
	 * @param {string} state 状态
	 * @param {string} context label
	 * @param {string} target_url 详细信息链接
	 * @param {string} description 描述
	 */
	async setPRStatus (number, state = 'success', context = 'default', targetUrl = '', description = '') {
		let info = await this.getPRInfo(number);
		let sha = info['head']['sha'];
		return this.requestGitHub(`/statuses/${sha}`, 'POST', true, {
			state: state,
			target_url: targetUrl,
			description: description,
			context: context
		});
	}

	/**
	 * 获取 PR 检查的状态
	 * @param {string} number PR序号
	 */
	async getPRStatus (number) {
		let info = await this.getPRInfo(number);
		let ref = info['head']['sha'];
		return this.requestGitHub(`/commits/${ref}/statuses`, 'GET', true);
	}

	/**
	 * 获取一个PR是否已经被merged
	 * @param {string} number PR序号
	 */
	async getPRMergeStatus (number) {
		let statusCode = await this.requestGitHub(`/pulls/${number}/merge`, 'GET', false);
		return statusCode === 204;
	}

	/**
	 * 请求GitHub 的 API 接口
	 * @param {string} path api路径
	 * @param {string} method 方法
	 * @param {boolean} loadData 是否解析返回内容
	 * @param {object | null} requestBody 请求参数
	 */
	requestGitHub (path = '/', method = 'GET', loadData = false, requestBody = null, option = {media: '+json'}) {
		return new Promise((resolve, reject) => {
			const request = https.request({
				host: 'api.github.com',
				path: `/repos/${this._repo}${path}`,
				method: method,
				headers: {
					'Accept': `application/vnd.github.v3${option.media}`,
					'User-Agent': this._userAgent,
					'Authorization': `token ${this._token}`
				}
			}, function (response) {
				console.log(`${method} ${path} => ` + response.statusCode);
				if (loadData) {
					let chunks = [];
					response.on('data', chunk => chunks.push(chunk));
					response.on('end', () => {
						let data = Buffer.concat(chunks).toString();
						if (/json/.test(option.media)) {
							try {
								data = JSON.parse(data);
							} catch (e) {
								return reject(new Error('JSON Parsing Failed.'));
							}
						}
						resolve(data);
					});
				} else {
					resolve(response.statusCode);
				}
			});
			if (requestBody) {
				request.write(JSON.stringify(requestBody));
			}
			request.on('error', e => reject(new Error('Request Failed.')));
			request.setTimeout(10000, () => reject(new Error(`Request Timeout ${method} ${path}`)));
			request.end();
		});
	}
}

module.exports = GitHubAPI;
