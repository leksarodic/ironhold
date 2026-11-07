import assert from 'node:assert/strict';
import { test } from 'node:test';
import { useSettingsStore, DEFAULT_SETTINGS } from '../src/store/useSettingsStore';

test('settings start at documented defaults', () => {
  const s = useSettingsStore.getState();
  assert.equal(s.volume, DEFAULT_SETTINGS.volume);
  assert.equal(s.haptics, true);
  assert.equal(s.combatText, true);
  assert.equal(s.joystickSize, 128);
});

test('volume is clamped to 0..1', () => {
  const s = useSettingsStore.getState();
  s.setVolume(5);
  assert.equal(useSettingsStore.getState().volume, 1);
  s.setVolume(-3);
  assert.equal(useSettingsStore.getState().volume, 0);
  s.setVolume(0.42);
  assert.equal(useSettingsStore.getState().volume, 0.42);
});

test('toggles flip and flip back', () => {
  const s = useSettingsStore.getState();
  const before = s.haptics;
  s.toggleHaptics();
  assert.equal(useSettingsStore.getState().haptics, !before);
  s.toggleHaptics();
  assert.equal(useSettingsStore.getState().haptics, before);
});

test('joystick size is clamped to a usable range', () => {
  const s = useSettingsStore.getState();
  s.setJoystickSize(10);
  assert.equal(useSettingsStore.getState().joystickSize, 96);
  s.setJoystickSize(9999);
  assert.equal(useSettingsStore.getState().joystickSize, 160);
});

test('reset restores defaults', () => {
  const s = useSettingsStore.getState();
  s.setVolume(0.1);
  s.toggleGrid();
  s.toggleHaptics();
  s.reset();
  const after = useSettingsStore.getState();
  assert.equal(after.volume, DEFAULT_SETTINGS.volume);
  assert.equal(after.showGrid, DEFAULT_SETTINGS.showGrid);
  assert.equal(after.haptics, DEFAULT_SETTINGS.haptics);
});
