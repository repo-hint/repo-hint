const GitHubAPI = require('./github-api');

/**
 * 主函数
 * @param {string} command
 * @param {string[]} args
 */
async function main (command, args, {REPO, USER_AGENT, TOKEN}) {
	let pr, content, state, info;

	const api = new GitHubAPI({
		repo: REPO,
		userAgent: USER_AGENT,
		token: TOKEN
	});

	switch (command) {
	case 'comment:list':
		[pr] = args;
		let list = await api.getPRComments(pr);
		console.log(list);
		break;
	case 'comment:add':
		[pr, content] = args;
		await api.addCommentOnPR(pr, content);
		break;
	case 'comment:delete':
		const [commentID] = args;
		await api.deleteAComment(commentID);
		break;
	case 'pr:review':
		[pr] = args;
		info = await api.getPRReviews(pr);
		console.log(info);
		break;
	case 'pr:review:add': {
		const [pr, content, event] = args;
		await api.createPRReview(pr, content, event);
	} break;
	case 'pr:file':
		[pr] = args;
		info = await api.getPRFiles(pr);
		console.log(JSON.stringify(info, null, 2));
		break;
	case 'pr:info':
		[pr] = args;
		info = await api.getPRInfo(pr);
		delete info._links;
		delete info.base;
		delete info.head;
		info.user = info.user.login;
		console.log(info);
		break;
	case 'pr:isMerged':
		[pr] = args;
		info = await api.getPRMergeStatus(pr);
		console.log(info);
		break;
	case 'pr:update':
		[pr, state] = args;
		await api.updatePRState(pr, state);
		break;
	case 'pr:status':
		[pr] = args;
		info = await api.getPRStatus(pr);
		console.log(info);
		break;
	case 'pr:status:set':
		info = await api.setPRStatus(...args);
		console.log(info);
		break;
	default:
		console.log(`
  mmm    "     m   #             #        mmmmm         #               m
m"   " mmm  mm#mm  # mm   m   m  #mmm     #   "#  mmm   #mmm    mmm   mm#mm
#   mm   #    #    #"  #  #   #  #" "#    #mmmm" #" "#  #" "#  #" "#    #
#    #   #    #    #   #  #   #  #   #    #   "m #   #  #   #  #   #    #
 "mmm" mm#mm  "mm  #   #  "mm"#  ##m#"    #    " "#m#"  ##m#"  "#m#"    "mm
		`);
		console.log(`
    comment:list   $PRNumber
    comment:add    $PRNumber $content
    comment:delete $commentID
    pr:info        $PRNumber
    pr:review      $PRNUmber
    pr:review:add  $PRNUmber $content
    pr:file        $PRNumber
    pr:isMerged    $PRNumber
    pr:update      $PRNumber $state {open | closed}
    pr:status      $PRNumber
    pr:status:set  $PRNumber $status $context $targetUrl $description
		`);
		break;
	}
}

module.exports = main;
