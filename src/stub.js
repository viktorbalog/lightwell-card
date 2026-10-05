// The home a new card starts with (HA's card picker calls getStubConfig): one room 5 × 4 m with a window, a sofa, and
// a lamp with its marker, lit by the first light in the house (or a made-up one), so that the card shows something
// and its editor has something to change. Its parts are tagged as the editor's Build view tags what it makes (`part`),
// so that they're picked there as one: the room (its walls, floor and label), the window, the lamp.

export function stubHome(states = {}) {
  const light = Object.keys(states).sort().find(id => id.startsWith('light.')) || 'light.living_room';
  return {
    description: 'A new home: change it in the card editor, or describe yours as the README says.',
    view: {x: -20, y: -20, w: 590, h: 490},
    units_per_metre: 100,
    rooms: {room: [[25, 25, 500, 400]]},
    drawing: {
      floors: [{rect: [25, 25, 500, 400], class: 'floor', part: 'room'}],
      walls: [
        {rect: [0, 0, 550, 25], class: 'wall', part: 'room'},
        {rect: [0, 425, 175, 25], class: 'wall', part: 'room'},
        {rect: [375, 425, 175, 25], class: 'wall', part: 'room'},
        {rect: [0, 25, 25, 400], class: 'wall', part: 'room'},
        {rect: [525, 25, 25, 400], class: 'wall', part: 'room'},
      ],
      glazing: [{rect: [175, 432, 200, 10], class: 'glass', part: 'window_1'}],
      labels: [{text: 'Room', at: [275, 90], class: 'room', part: 'room'}],
    },
    openings: [{wall: 'bottom', at: 450, depth: 25, x: 175, w: 200, lo: 0.9, hi: 2.2, room: 'room', part: 'window_1'}],
    furniture: {sofa: {shape: {rect: [175, 300, 200, 85], rx: 8}, height: 0.8, shadow_room: 'room'}},
    lights: [{entities: [light], shape: [{circle: [275, 200, 60]}], over: true, clip: 'room',
      pool: {x: 275, y: 200, r: 350, height: 1.5, shadows: ['sofa']}, part: 'lamp_1'}],
    markers: [{entity: light, x: 275, y: 200, icon: 'mdi:ceiling-light', tap: 'toggle', part: 'lamp_1'}],
    sun: {north: 0},
  };
}
