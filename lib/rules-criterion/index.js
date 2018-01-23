const fs = require('fs');

module.exports = fs
	.readdirSync(__dirname)
	.filter(rule => !(/index\.js/.test(rule)))
	.map(rule => require(`${__dirname}/${rule}`));
