#!/bin/sh

echo -n 'javascript:(function(){'; yui-compressor kanbanise.js; echo "})();"
