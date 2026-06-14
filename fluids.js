(function () {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;";
    document.body.appendChild(canvas);

    const gl = canvas.getContext("webgl");
    if (!gl) return;

    const N = 128;
    let velocity_x = new Float32Array(N * N);
    let velocity_y = new Float32Array(N * N);
    let velocity_x_prev = new Float32Array(N * N);
    let velocity_y_prev = new Float32Array(N * N);
    let density = new Float32Array(N * N);
    let density_prev = new Float32Array(N * N);

    const VISC = 0.00001;
    const DIFF = 0.00002;
    const DISSIPATION = 0.992;
    const DT = 0.1;
    const ITER = 4;

    function idx(x, y) {
        x = Math.max(1, Math.min(N - 2, x));
        y = Math.max(1, Math.min(N - 2, y));
        return x + y * N;
    }

    function addSource(x, s) {
        for (let i = 0; i < N * N; i++) x[i] += DT * s[i];
    }

    function diffuse(b, x, x0, diff) {
        const a = DT * diff * (N - 2) * (N - 2);
        for (let k = 0; k < ITER; k++) {
            for (let j = 1; j < N - 1; j++) {
                for (let i = 1; i < N - 1; i++) {
                    x[idx(i, j)] = (x0[idx(i, j)] + a * (
                        x[idx(i - 1, j)] + x[idx(i + 1, j)] +
                        x[idx(i, j - 1)] + x[idx(i, j + 1)]
                    )) / (1 + 4 * a);
                }
            }
            setBnd(b, x);
        }
    }

    function advect(b, d, d0, vx, vy) {
        const dt0 = DT * (N - 2);
        for (let j = 1; j < N - 1; j++) {
            for (let i = 1; i < N - 1; i++) {
                let x = i - dt0 * vx[idx(i, j)];
                let y = j - dt0 * vy[idx(i, j)];
                x = Math.max(0.5, Math.min(N - 1.5, x));
                y = Math.max(0.5, Math.min(N - 1.5, y));
                const i0 = Math.floor(x), i1 = i0 + 1;
                const j0 = Math.floor(y), j1 = j0 + 1;
                const s1 = x - i0, s0 = 1 - s1;
                const t1 = y - j0, t0 = 1 - t1;
                d[idx(i, j)] = s0 * (t0 * d0[idx(i0, j0)] + t1 * d0[idx(i0, j1)]) +
                                s1 * (t0 * d0[idx(i1, j0)] + t1 * d0[idx(i1, j1)]);
            }
        }
        setBnd(b, d);
    }

    function project(vx, vy, p, div) {
        const h = 1.0 / (N - 2);
        for (let j = 1; j < N - 1; j++) {
            for (let i = 1; i < N - 1; i++) {
                div[idx(i, j)] = -0.5 * h * (
                    vx[idx(i + 1, j)] - vx[idx(i - 1, j)] +
                    vy[idx(i, j + 1)] - vy[idx(i, j - 1)]
                );
                p[idx(i, j)] = 0;
            }
        }
        setBnd(0, div); setBnd(0, p);
        for (let k = 0; k < ITER; k++) {
            for (let j = 1; j < N - 1; j++) {
                for (let i = 1; i < N - 1; i++) {
                    p[idx(i, j)] = (div[idx(i, j)] +
                        p[idx(i - 1, j)] + p[idx(i + 1, j)] +
                        p[idx(i, j - 1)] + p[idx(i, j + 1)]) / 4;
                }
            }
            setBnd(0, p);
        }
        for (let j = 1; j < N - 1; j++) {
            for (let i = 1; i < N - 1; i++) {
                vx[idx(i, j)] -= 0.5 * (p[idx(i + 1, j)] - p[idx(i - 1, j)]) / h;
                vy[idx(i, j)] -= 0.5 * (p[idx(i, j + 1)] - p[idx(i, j - 1)]) / h;
            }
        }
        setBnd(1, vx); setBnd(2, vy);
    }

    function setBnd(b, x) {
        for (let i = 1; i < N - 1; i++) {
            x[idx(i, 0)] = b === 2 ? -x[idx(i, 1)] : x[idx(i, 1)];
            x[idx(i, N - 1)] = b === 2 ? -x[idx(i, N - 2)] : x[idx(i, N - 2)];
            x[idx(0, i)] = b === 1 ? -x[idx(1, i)] : x[idx(1, i)];
            x[idx(N - 1, i)] = b === 1 ? -x[idx(N - 2, i)] : x[idx(N - 2, i)];
        }
        x[idx(0, 0)] = 0.5 * (x[idx(1, 0)] + x[idx(0, 1)]);
        x[idx(0, N - 1)] = 0.5 * (x[idx(1, N - 1)] + x[idx(0, N - 2)]);
        x[idx(N - 1, 0)] = 0.5 * (x[idx(N - 2, 0)] + x[idx(N - 1, 1)]);
        x[idx(N - 1, N - 1)] = 0.5 * (x[idx(N - 2, N - 1)] + x[idx(N - 1, N - 2)]);
    }

    function velStep() {
        addSource(velocity_x, velocity_x_prev);
        addSource(velocity_y, velocity_y_prev);
        [velocity_x, velocity_x_prev] = [velocity_x_prev, velocity_x];
        [velocity_y, velocity_y_prev] = [velocity_y_prev, velocity_y];
        diffuse(1, velocity_x, velocity_x_prev, VISC);
        diffuse(2, velocity_y, velocity_y_prev, VISC);
        project(velocity_x, velocity_y, velocity_x_prev, velocity_y_prev);
        [velocity_x, velocity_x_prev] = [velocity_x_prev, velocity_x];
        [velocity_y, velocity_y_prev] = [velocity_y_prev, velocity_y];
        advect(1, velocity_x, velocity_x_prev, velocity_x_prev, velocity_y_prev);
        advect(2, velocity_y, velocity_y_prev, velocity_x_prev, velocity_y_prev);
        project(velocity_x, velocity_y, velocity_x_prev, velocity_y_prev);
        velocity_x_prev.fill(0); velocity_y_prev.fill(0);
    }

    function densStep() {
        addSource(density, density_prev);
        [density, density_prev] = [density_prev, density];
        diffuse(0, density, density_prev, DIFF);
        [density, density_prev] = [density_prev, density];
        advect(0, density, density_prev, velocity_x, velocity_y);
        density_prev.fill(0);
        for (let i = 0; i < N * N; i++) density[i] *= DISSIPATION;
    }

    // WebGL rendering
    const vsrc = `
        attribute vec2 a_pos;
        varying vec2 v_uv;
        void main(){v_uv=a_pos*0.5+0.5;gl_Position=vec4(a_pos,0,1);}
    `;
    const fsrc = `
        precision mediump float;
        uniform sampler2D u_tex;
        varying vec2 v_uv;
        void main(){
            float d=texture2D(u_tex,v_uv).r;
            gl_FragColor=vec4(d,d,d,1.0);
        }
    `;

    function makeShader(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s); return s;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, makeShader(gl.VERTEX_SHADER, vsrc));
    gl.attachShader(prog, makeShader(gl.FRAGMENT_SHADER, fsrc));
    gl.linkProgram(prog); gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener("resize", resize);
    resize();

    // Mouse interaction
    let mx = 0, my = 0, pmx = 0, pmy = 0;
    window.addEventListener("mousemove", e => {
        pmx = mx; pmy = my;
        mx = e.clientX; my = e.clientY;
        const gx = Math.floor((mx / window.innerWidth) * N);
        const gy = Math.floor((my / window.innerHeight) * N);
        const dx = (mx - pmx) * 0.5;
        const dy = (my - pmy) * 0.5;
        const r = 3;
        for (let j = -r; j <= r; j++) {
            for (let i = -r; i <= r; i++) {
                velocity_x_prev[idx(gx + i, gy + j)] += dx;
                velocity_y_prev[idx(gx + i, gy + j)] += dy;
                density_prev[idx(gx + i, gy + j)] += 0.3;
            }
        }
    });

    // Chat splash — called from Blazor
    window.fluidSplash = function (nx, ny) {
        const gx = Math.floor(nx * N);
        const gy = Math.floor(ny * N);
        const r = 8;
        const strength = 6;
        for (let j = -r; j <= r; j++) {
            for (let i = -r; i <= r; i++) {
                const dist = Math.sqrt(i * i + j * j);
                if (dist > r) continue;
                const falloff = 1 - dist / r;
                const angle = Math.random() * Math.PI * 2;
                velocity_x_prev[idx(gx + i, gy + j)] += Math.cos(angle) * strength * falloff;
                velocity_y_prev[idx(gx + i, gy + j)] += Math.sin(angle) * strength * falloff;
                density_prev[idx(gx + i, gy + j)] += falloff * 2;
            }
        }
    };

    const pixelBuf = new Uint8Array(N * N * 4);

    function loop() {
        velStep();
        densStep();

        for (let i = 0; i < N * N; i++) {
            const v = Math.min(255, density[i] * 800);
            pixelBuf[i * 4 + 0] = v;
            pixelBuf[i * 4 + 1] = v;
            pixelBuf[i * 4 + 2] = v;
            pixelBuf[i * 4 + 3] = 255;
        }

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuf);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        requestAnimationFrame(loop);
    }

    loop();
})();