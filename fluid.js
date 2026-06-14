
// Sound effects for messages.
const splashSounds = [
    new Audio('sound1.wav'),
    new Audio('sound2.wav'),
    new Audio('sound3.wav'),
    new Audio('sound4.wav'),
    new Audio('sound5.wav'),
    new Audio('sound6.wav'),
    new Audio('sound7.wav'),
];

function playSplashSound() {
    const sound = splashSounds[Math.floor(Math.random() * splashSounds.length)].cloneNode();
    sound.volume = 0.5;
    sound.play();
}
// Load Pavel's fluid sim from CDN
window.fluidSplash = function(nx, ny) {
    multipleSplats(Math.floor(Math.random() * 5) + 3);
    playSplashSound();
};