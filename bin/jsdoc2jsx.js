#!/usr/bin/env node

var path = require('path');
var templatePath = path.resolve(__dirname, '../jsxtemplate');

var newargv = [];

for (var i = 0; i < process.argv.length; i++)
{
    if (process.argv[i] === '-t')
    {
        i++
    }
    else
    {
        newargv.push(process.argv[i]);
    }
}

newargv.splice(2, 0, '-t=' + templatePath);

process.argv = newargv;

require('../node_modules/jsdoc2/app/run.js');
