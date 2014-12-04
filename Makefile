%.png: %.svg
	inkscape --without-gui --export-png=$@ --export-area-page $<

%.css: %.scss
	sass -I$$(dirname $$(gem which bourbon))/../app/assets/stylesheets $< > $@

%.mp3: %.wav
	lame -b 128 $< $@

%.ogg: %.wav
	oggenc -q 1 $< -o $@

main.js: src/*.ts
	tsc --noImplicitAny --sourceMap --out $@ $^
