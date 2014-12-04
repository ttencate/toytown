#!/bin/bash

rsync -av --delete --exclude-from='no-upload.txt' ./ frozenfractal.com:/var/www/ld31.frozenfractal.com/
