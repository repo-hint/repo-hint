/**
 * Check the title of the Pull Request
 * @param {any} PRInfo
 */

async function handle (PRInfo) {
	const title = await PRInfo.get('title');
	let comments = ''; // comment 内容

	let passed = true;
	if (!/(【|\[)\s*[^\s]+.*\s*(】|\])(\s*)[^\s]+.*/.test(title)) {
		comments += `**这个 PR 的标题不符合规范！** \n 标题以 [部门] 或是 [业务] 开头，以 PR 内容结束 \n\n`;
		passed = false;
	}

	return {comments, passed};
}

module.exports = {
	name: 'info-check',
	main: handle,
	commentOnce: true
};
