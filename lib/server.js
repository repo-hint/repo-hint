const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const prCheck = require('./prCheck');

const lastRequest = {
	pr: '',
	time: Date.now()
};

const configFolderPath = process.argv[2];
let config = fs.readFileSync(path.join(configFolderPath, 'config.json'), {encoding: 'utf8'});
try {
	config = JSON.parse(config);
} catch (e) {
	console.error('Fail parsing configuration.');
	process.exit(1);
}
const {SECRET_KEY, SERVER_PORT, REPO} = config;
if (!SECRET_KEY || !SERVER_PORT) {
	console.error('No suitable configuration.');
	process.exit(1);
}

http.createServer(function (request, response) {
	const {query, pathname} = url.parse(request.url, true);

	// 路径不对
	if (pathname !== '/api/pr/check' || request.method.toUpperCase() !== 'GET') {
		response.writeHead(404, {'content-type': 'text/plain'});
		response.write('Not Found');
		response.end();
		return;
	}

	const {pr, token} = query;
	if (!pr) {
		response.writeHead(403, {'content-type': 'text/plain'});
		response.write('Parameters Need');
		response.end();
		return;
	}
	let hmac = crypto.createHmac('sha256', SECRET_KEY);
	hmac.update(pr);
	let code = hmac.digest('hex');

	// 验证错误
	if (token !== code) {
		response.writeHead(403, {'content-type': 'text/plain'});
		response.write('Forbidden Access');
		response.end();
		return;
	}

	// 访问太频繁
	if (lastRequest['pr'] === pr && Date.now() - lastRequest['time'] < 10000) {
		response.writeHead(403, {'content-type': 'text/plain'});
		response.write('Frequent Request, Please wait for a while');
		response.end();
		return;
	}

	prCheck({number: pr}, configFolderPath, {
		criterionRules: {
			on: true,
			disableCommentOnce: true
		}
	});
	response.writeHead(200, {'content-type': 'text/html'});
	response.write(
		`<p>Now start checking, please refer to ` +
		`<a target='_blank' href='https://github.com/${REPO}/pull/${pr}'>https://github.com/${REPO}/pull/${pr}</a></p>`);
	response.end();
	lastRequest['time'] = Date.now();
	lastRequest['pr'] = pr;
}).listen(SERVER_PORT);

console.log(`Pull Request Title & Description Check Server Listening on ${SERVER_PORT}...`);
