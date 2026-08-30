// src/js/compass.js
// Handles DeviceOrientation for iOS/Android and rotates the compass image.

const compassImg = document.getElementById('compass');
const degreeLabel = document.getElementById('degree');
const permissionBtn = document.getElementById('permissionBtn');

function updateCompass(alpha) {
  const rotation = (360 - alpha) % 360;
  compassImg.style.transform = `rotate(${rotation}deg)`;
  const displayDeg = Math.round(alpha);
  degreeLabel.textContent = `${displayDeg}°`;
}

function handleOrientation(event) {
  const alpha = event.alpha;
  if (typeof alpha === 'number') {
    updateCompass(alpha);
  }
}

function initOrientation() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    permissionBtn.classList.remove('hidden');
    permissionBtn.addEventListener('click', async () => {
      try {
        const response = await DeviceOrientationEvent.requestPermission();
        if (response === 'granted') {
          permissionBtn.classList.add('hidden');
          window.addEventListener('deviceorientation', handleOrientation);
        } else {
          alert('Permission denied for motion & orientation.');
        }
      } catch (e) {
        console.error(e);
        alert('Permission request failed.');
      }
    });
  } else {
    window.addEventListener('deviceorientation', handleOrientation);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOrientation);
} else {
  initOrientation();
}
