// Room codes look like "abc-defg-hij" (3-4-3 lowercase letters). This
// accepts either a bare code or a pasted invite link — full URL
// ("http://localhost:5173/meeting/abc-defg-hij"), with or without a
// trailing "/lobby" — by pulling the pattern out wherever it appears.
const ROOM_ID_PATTERN = /[a-z]{3}-[a-z]{4}-[a-z]{3}/;

export const parseRoomIdInput = (input) => {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  const match = trimmed.match(ROOM_ID_PATTERN);
  return match ? match[0] : null;
};
