const app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x0f2027,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    resizeTo: window
});
document.querySelector('.background').appendChild(app.view);

const vertex = `
    attribute vec2 aVertexPosition;
    varying vec2 vTextureCoord;
    void main() {
        vTextureCoord = aVertexPosition;
        gl_Position = vec4((aVertexPosition - 0.5) * 2.0, 0.0, 1.0);
    }
`;

const fragment = `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform float time;
    uniform vec2 mouse;
    void main() {
        vec2 p = vTextureCoord * 2.0 - 1.0;
        vec2 m = mouse * 2.0 - 1.0;
        float d = length(p - m);
        float ripple = sin(10.0 * d - time * 5.0);
        float intensity = 1.0 / (d * 10.0 + 0.1);
        gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0) * ripple * intensity;
    }
`;

const uniforms = {
    time: 0,
    mouse: [0, 0]
};

const shader = new PIXI.Filter(vertex, fragment, uniforms);
app.stage.filters = [shader];

app.ticker.add(delta => {
    shader.uniforms.time += delta / 60;
});

app.view.addEventListener('mousemove', event => {
    shader.uniforms.mouse[0] = event.clientX / app.view.width;
    shader.uniforms.mouse[1] = 1.0 - event.clientY / app.view.height;
});
