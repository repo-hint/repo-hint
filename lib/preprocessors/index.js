const fs = require('fs');

module.exports = fs
	.readdirSync(__dirname)
	.filter(processor => !(/index\.js/.test(processor)))
	.map(processor => require(`${__dirname}/${processor}`));
