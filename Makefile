%.premult.png: %.png
	convert $< \( +clone -alpha Extract \) -channel RGB -compose Multiply -composite $@

%.png: %.svg
	inkscape --without-gui --export-png=$@ --export-area-page $<

%.css: %.scss
	sass -I$$(dirname $$(gem which bourbon))/../app/assets/stylesheets $< > $@

%.mp3: %.wav
	lame -b 128 $< $@

%.ogg: %.wav
	oggenc -q 1 $< -o $@

main.js main.js.map: src/*.ts
	tsc --sourceMap --out main.js $^

.PHONY: watch
watch:
	while inotifywait -q -q -e close_write,move,create,delete src; do make -s main.js && echo 'Compilation successful'; done
