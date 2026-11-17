#!/bin/bash
cd /home/z/my-project
node ./node_modules/.bin/next dev -p 3000 -H 0.0.0.0 > dev.log 2>&1 &
echo $! > /home/z/my-project/server.pid
