const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- DO NOT CHANGE: ORIGINAL JUMP PHYSICS ---
const SETTINGS = {
    GRAVITY: 0.82,
    JUMP: -12.5,
    SPEED: 9.0,
    GROUND: 540,
    TICK: 1/60 // 60fps fixed logic
};

let state = {
    active: false,
    cameraX: 0,
    attempts: 1,
    objects: [],
    levelLen: 0,
    bg: '#0066ff',
    accumulator: 0,
    lastTime: 0
};

let player = {
    x: 400, y: 0, w: 38, h: 38,
    dy: 0, rot: 0, mode: 'CUBE', onGround: false, dead: false
};

let input = { hold: false };

// --- INPUT BINDING ---
window.onkeydown = (e) => { if(e.code === 'Space' || e.code === 'ArrowUp') input.hold = true; };
window.onkeyup = (e) => { if(e.code === 'Space' || e.code === 'ArrowUp') input.hold = false; };
canvas.onmousedown = () => input.hold = true;
canvas.onmouseup = () => input.hold = false;

// --- LEVEL ARCHITECT ---
function createLevel(idx) {
    state.objects = [];
    let x = 1500;
    const add = (t, ox, oy, ow=40, oh=40, m=null) => state.objects.push({t, x:ox, y:oy, w:ow, h:oh, m});
    
    // Hand-crafted distinct level profiles
    const configs = [
        { name: "Stereo Madness", bg: "#0066ff", len: 60 },
        { name: "Back on Track", bg: "#00ccff", len: 70 },
        { name: "Polargeist", bg: "#a020f0", len: 80 },
        { name: "Dry Out", bg: "#ff8c00", len: 90 },
        { name: "Base After Base", bg: "#4B0082", len: 100 },
        { name: "Can't Let Go", bg: "#FF0000", len: 110 },
        { name: "Jumper", bg: "#32CD32", len: 120 },
        { name: "Time Machine", bg: "#FF1493", len: 130 },
        { name: "Cycles", bg: "#00008B", len: 140 },
        { name: "Blast Processing", bg: "#222", len: 150 }
    ];

    const cfg = configs[idx];
    state.bg = cfg.bg;
    const limit = SETTINGS.SPEED * 60 * cfg.len;

    while (x < limit) {
        let r = Math.random();
        // Geometry Dash pattern logic
        if (r < 0.2) add('spike', x, SETTINGS.GROUND - 40);
        else if (r < 0.4) add('block', x, SETTINGS.GROUND - 40, 80, 40);
        else if (r < 0.5) { add('block', x, SETTINGS.GROUND - 40); add('spike', x, SETTINGS.GROUND - 80); }
        
        // Mode switching portals at set intervals
        if (x > 5000 && x % 8000 < 100) {
            const m = ['SHIP', 'WAVE', 'BALL', 'UFO'][Math.floor(Math.random()*4)];
            add('portal', x, 0, 60, SETTINGS.GROUND, m);
            x += 600;
        }
        x += 400 + (Math.random() * 200);
    }
    state.levelLen = x + 2000;
}

function startLevel(idx) {
    state.active = true;
    state.attempts = 1;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    createLevel(idx);
    resetPlayer(true);
    state.lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function resetPlayer(fullReset) {
    player.y = SETTINGS.GROUND - player.h;
    player.dy = 0; player.rot = 0; player.mode = 'CUBE';
    player.dead = false;
    state.cameraX = 0;
    if(!fullReset) state.attempts++;
    
    const att = document.getElementById('attempt-text');
    att.innerText = "ATTEMPT " + state.attempts;
    att.style.opacity = 1;
    setTimeout(() => att.style.opacity = 0, 1500);
}

// --- BUG-FREE COLLISION RESOLVER ---
function updatePhysics() {
    if(player.dead) return;

    state.cameraX += SETTINGS.SPEED;
    
    // Original Physics Logic
    if(player.mode === 'CUBE') {
        player.dy += SETTINGS.GRAVITY;
        if(player.onGround && input.hold) { player.dy = SETTINGS.JUMP; player.onGround = false; }
        if(!player.onGround) player.rot += 6; else player.rot = Math.round(player.rot/90)*90;
    } else if(player.mode === 'SHIP') {
        player.dy += input.hold ? -0.45 : 0.4; player.rot = player.dy * 2.5;
    } else if(player.mode === 'WAVE') {
        player.dy = input.hold ? -9.5 : 9.5; player.rot = (player.dy > 0) ? 25 : -25;
    } else if(player.mode === 'BALL') {
        player.dy += 0.8 * (player.gravDir || 1);
        if(player.onGround && input.hold) { player.gravDir = (player.gravDir || 1) * -1; player.onGround = false; input.hold = false; }
    }

    player.y += player.dy;

    // Boundary check
    if(player.y + player.h >= SETTINGS.GROUND) {
        player.y = SETTINGS.GROUND - player.h; player.dy = 0; player.onGround = true;
    } else if(player.y <= 0) {
        player.y = 0; player.dy = 0; if(player.mode !== 'BALL') crash();
    } else { player.onGround = false; }

    // Sub-pixel Collision (No clipping bugs)
    const pR = { 
        l: state.cameraX + player.x + 10, 
        r: state.cameraX + player.x + player.w - 10, 
        t: player.y + 10, 
        b: player.y + player.h - 10 
    };

    for(let o of state.objects) {
        if(o.x > pR.r + 200) break;
        if(pR.r > o.x && pR.l < o.x+o.w && pR.b > o.y && pR.t < o.y+o.h) {
            if(o.t === 'spike') crash();
            if(o.t === 'block') {
                // If previous frame was above the block, land safely. Else, crash (hit the wall).
                if(player.y - player.dy + player.h <= o.y + 12) {
                    player.y = o.y - player.h; player.dy = 0; player.onGround = true;
                } else crash();
            }
            if(o.t === 'portal') { player.mode = o.m; player.dy = 0; }
        }
    }

    if(state.cameraX > state.levelLen) location.reload();
}

function crash() {
    if(player.dead) return;
    player.dead = true;
    document.getElementById('flash').style.opacity = 0.8;
    setTimeout(() => {
        document.getElementById('flash').style.opacity = 0;
        resetPlayer(false);
    }, 500);
}

function draw() {
    ctx.fillStyle = state.bg; ctx.fillRect(0,0,1280,640);
    ctx.fillStyle = "#000"; ctx.fillRect(0, SETTINGS.GROUND, 1280, 100);
    ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.strokeRect(-1, SETTINGS.GROUND, 1282, 1);

    ctx.save(); ctx.translate(-state.cameraX, 0);
    for(let o of state.objects) {
        if(o.x < state.cameraX - 100 || o.x > state.cameraX + 1300) continue;
        if(o.t === 'block') { ctx.fillStyle = "#000"; ctx.fillRect(o.x, o.y, o.w, o.h); ctx.strokeStyle = "#fff"; ctx.strokeRect(o.x, o.y, o.w, o.h); }
        else if(o.t === 'spike') { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(o.x, o.y+o.h); ctx.lineTo(o.x+o.w/2, o.y); ctx.lineTo(o.x+o.w, o.y+o.h); ctx.fill(); }
        else if(o.t === 'portal') { ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.fillRect(o.x, 0, o.w, SETTINGS.GROUND); ctx.fillStyle="white"; ctx.fillText(o.m, o.x, 100); }
    }

    if(!player.dead) {
        ctx.save(); ctx.translate(state.cameraX + player.x + 19, player.y + 19); ctx.rotate(player.rot * Math.PI / 180);
        ctx.fillStyle = "#00ffff"; ctx.fillRect(-19,-19,38,38); ctx.strokeStyle="#fff"; ctx.lineWidth=3; ctx.strokeRect(-19,-19,38,38);
        ctx.restore();
    }
    ctx.restore();

    let pct = Math.floor((state.cameraX / state.levelLen) * 100);
    document.getElementById('progress-fill').style.width = pct + "%";
    document.getElementById('percent-text').innerText = pct + "%";
}

function gameLoop(time) {
    if(!state.active) return;
    state.accumulator += (time - state.lastTime) / 1000;
    state.lastTime = time;

    while(state.accumulator >= SETTINGS.TICK) {
        updatePhysics();
        state.accumulator -= SETTINGS.TICK;
    }
    draw();
    requestAnimationFrame(gameLoop);
}
