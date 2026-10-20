const { customAlphabet } = require('nanoid');

// Lowercase letters only, excluding i/l/o (easily misread as 1/0 when
// spoken or retyped) — Google Meet style: "abc-defg-hij".
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz';
const nanoid3 = customAlphabet(ALPHABET, 3);
const nanoid4 = customAlphabet(ALPHABET, 4);

const generateRoomId = () => `${nanoid3()}-${nanoid4()}-${nanoid3()}`;

/**
 * Generates a roomId guaranteed not to collide with an existing meeting.
 * This check-then-write loop makes the happy path clean; the `unique`
 * index on Meeting.roomId is what actually enforces correctness under
 * concurrent writes.
 */
const generateUniqueRoomId = async (MeetingModel, maxAttempts = 5) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const roomId = generateRoomId();
    // eslint-disable-next-line no-await-in-loop
    const existing = await MeetingModel.exists({ roomId });
    if (!existing) return roomId;
  }
  throw new Error('Could not generate a unique room ID after several attempts');
};

module.exports = { generateRoomId, generateUniqueRoomId };
