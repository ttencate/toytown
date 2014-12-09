/// <reference path="../typings/tsd.d.ts" />
/// <reference path="city.ts" />
/// <reference path="renderer.ts" />

var VERTEX_FLOATS = 2 + 2 + 1;
var VERTEX_BYTES = 4 * VERTEX_FLOATS;

var SPRITE_VERTICES = 6;
var SPRITE_FLOATS = SPRITE_VERTICES * VERTEX_FLOATS;
var SPRITE_BYTES = 4 * SPRITE_FLOATS;

class RendererWebGL extends AbstractRenderer {
  private capacity = 1024 * SPRITE_FLOATS;

  private sprites: Float32Array;
  private index = 0;
  private alpha = 1;

  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private texture: WebGLTexture;
  private image: HTMLImageElement;

  constructor(city: City, canvas: JQuery) {
    super(city, canvas);
    this.gl = this.canvasElt.getContext('webgl', {depth: false});
    if (!this.gl) {
      throw new Error('No WebGL support');
    }
    this.sprites = new Float32Array(this.capacity);

    this.image = <HTMLImageElement>document.createElement('img');
    this.image.src = 'sprites.premult.png';

    // Try to handle context loss. Untested.
    this.canvasElt.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
    }, false);
    this.canvasElt.addEventListener("webglcontextrestored", (e) => {
      this.program = null;
      this.buffer = null;
      this.texture = null;
    });
  }

  clear() {
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  setAlpha(alpha: number) {
    this.alpha = alpha;
  }

  drawSprite(coord: Coord, sprite: Sprite, variantX: number, variantY: number, ox: number, oy: number, scale: number) {
    if (this.index + SPRITE_FLOATS > this.capacity) {
      this.flush();
    }

    var l = this.getCenterX(coord) + this.scale * (ox - scale * sprite.ox);
    var b = this.getCenterY(coord) + this.scale * (oy - scale * sprite.oy);
    var r = l + this.scale * scale * sprite.w;
    var t = b + this.scale * scale * sprite.h;

    var tl = (sprite.x + variantX * sprite.w) / this.image.naturalWidth;
    var tb = (sprite.y + variantY * sprite.h) / this.image.naturalHeight;
    var tr = tl + sprite.w / this.image.naturalWidth;
    var tt = tb + sprite.h / this.image.naturalHeight;

    // l = 0; r = this.canvasWidth; b = 0; t = this.canvasHeight; tl = 0; tr = 1; tb = 0; tt = 1;
    this.addVertex(l, b, tl, tb);
    this.addVertex(r, b, tr, tb);
    this.addVertex(r, t, tr, tt);
    this.addVertex(r, t, tr, tt);
    this.addVertex(l, t, tl, tt);
    this.addVertex(l, b, tl, tb);
  }

  private addVertex(x: number, y: number, tx: number, ty: number) {
    this.sprites[this.index++] = x;
    this.sprites[this.index++] = y;
    this.sprites[this.index++] = tx;
    this.sprites[this.index++] = ty;
    this.sprites[this.index++] = this.alpha;
  }

  flush() {
    if (this.index == 0) return;
    var numFloats = this.index;
    this.index = 0;

    if (!this.program) {
      this.program = this.createProgram();
    }
    if (!this.texture) {
      this.texture = this.createTexture();
      if (!this.texture) return; // Not yet loaded.
    }
    if (!this.buffer) {
      this.buffer = this.createBuffer();
    }

    this.gl.viewport(0, 0, this.canvasWidth, this.canvasHeight);

    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.sprites.subarray(0, numFloats));

    this.gl.useProgram(this.program);

    var textureUnit = this.gl.getUniformLocation(this.program, 'u_textureUnit');
    this.gl.uniform1i(textureUnit, 0);
    var canvasSize = this.gl.getUniformLocation(this.program, 'u_canvasSize');
    this.gl.uniform2f(canvasSize, this.canvasWidth, this.canvasHeight);

    var position = this.gl.getAttribLocation(this.program, 'a_position');
    var texCoord = this.gl.getAttribLocation(this.program, 'a_texCoord');
    var alpha = this.gl.getAttribLocation(this.program, 'a_alpha');
    this.gl.enableVertexAttribArray(position);
    this.gl.enableVertexAttribArray(texCoord);
    this.gl.enableVertexAttribArray(alpha);
    this.gl.vertexAttribPointer(position, 2, this.gl.FLOAT, false, VERTEX_BYTES, 0);
    this.gl.vertexAttribPointer(texCoord, 2, this.gl.FLOAT, false, VERTEX_BYTES, 4 * 2);
    this.gl.vertexAttribPointer(alpha, 1, this.gl.FLOAT, false, VERTEX_BYTES, 4 * (2 + 2));

    this.gl.drawArrays(this.gl.TRIANGLES, 0, numFloats / VERTEX_FLOATS);
  }

  private createProgram(): WebGLProgram {
    var vertexShader = this.createShader('vertex',
        'uniform vec2 u_canvasSize;\n' +
        'attribute vec2 a_position;\n' +
        'attribute vec2 a_texCoord;\n' +
        'attribute float a_alpha;\n' +
        'varying vec2 v_texCoord;\n' +
        'varying float v_alpha;\n' +
        'void main() {\n' +
        '  gl_Position = vec4(vec2(1.0, -1.0) * (a_position / u_canvasSize * 2.0 - 1.0), 0.0, 1.0);\n' +
        '  v_texCoord = a_texCoord;\n' +
        '  v_alpha = a_alpha;\n' +
        '}\n'
    );
    var fragmentShader = this.createShader('fragment',
        'uniform sampler2D u_textureUnit;\n' +
        'varying mediump vec2 v_texCoord;\n' +
        'varying lowp float v_alpha;\n' +
        'void main() {\n' +
        '  gl_FragColor = v_alpha * texture2D(u_textureUnit, v_texCoord);\n' +
        '}\n'
    );

    var program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    var ok = this.gl.getProgramParameter(program, this.gl.LINK_STATUS);
    var log = this.gl.getProgramInfoLog(program);
    if (!ok) {
      throw new Error('Program link failed: ' + log);
    }
    if (log) {
      console.log('Program link', log);
    }

    return program;
  }

  private createShader(type: string, source: string) {
    var shader = this.gl.createShader(type == 'vertex' ? this.gl.VERTEX_SHADER : this.gl.FRAGMENT_SHADER);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    var ok = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS);
    var log = this.gl.getShaderInfoLog(shader);
    if (!ok) {
      throw new Error('Shader compilation failed (' + type + '): ' + log);
    }
    if (log) {
      console.log('Shader compilation', log);
    }

    return shader;
  }

  private createTexture(): WebGLTexture {
    if (!this.image || !this.image.complete) return null;
    var texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.image);
    this.gl.generateMipmap(this.gl.TEXTURE_2D);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    return texture;
  }

  private createBuffer(): WebGLBuffer {
    var buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.sprites.byteLength, this.gl.DYNAMIC_DRAW);
    return buffer;
  }

  private logError() {
    var error = this.gl.getError();
    if (error != this.gl.NO_ERROR) {
      console.error('WebGL error ' + error);
    }
  }
}
