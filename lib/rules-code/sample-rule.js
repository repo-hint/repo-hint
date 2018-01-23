/**
 * 判断是否修改 php 文件，PR 大小
 * @param {any} PRInfo
 */

async function handle (PRInfo) {
	const files = await PRInfo.get('files');
	const title = await PRInfo.get('title');
	const additions = await PRInfo.get('additions');
	const deletions = await PRInfo.get('deletions');
	let comments = ''; // comment 内容

	let phpCodeModified = files.filter(fileName => /\.php$/.test(fileName)).length > 0;
	if (phpCodeModified) {
		comments += '该 PR 修改了 PHP 代码文件！\n';
	}

	if ((additions + deletions) > 500) {
		comments += '这个 PR 太大了，请尽量分割成若干个小的 PR，方便进行 Code Review。\n';
	}

	// console.dir(await PRInfo.get('requestedReviewers'));
	// console.dir(await PRInfo.get('reviews'));

	console.log(JSON.stringify(await PRInfo.get('diff'), null, 2));

	return {comments, passed: true};
}

module.exports = {
	name: 'sample',
	main: handle,
	commentOnce: false
};
