import { StyleSheet } from 'react-native';
export { C, GRAD, COVER_GRAD, AVATAR_COLORS, R, scoreColor } from '@tunelog/shared';
import { C, R } from '@tunelog/shared';

export const S = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: C.bg },
  screenPad:    { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row:          { flexDirection: 'row', alignItems: 'center' },

  inputWrap: {
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.stroke,
    borderRadius: R.r2, paddingHorizontal: 16, height: 50, justifyContent: 'center',
  },
  inputFocused: { borderColor: C.violet },
  inputText:    { color: C.fg, fontSize: 15 },

  card:         { backgroundColor: C.glass, borderWidth: 1, borderColor: C.stroke, borderRadius: R.r4 },
  cardPad:      { backgroundColor: C.glass, borderWidth: 1, borderColor: C.stroke, borderRadius: R.r4, padding: 16 },

  dividerLine:  { flex: 1, height: 1, backgroundColor: C.stroke },
  dividerTxt:   { color: C.fg4, fontSize: 12, fontWeight: '500' as const },

  label:        { fontSize: 12, fontWeight: '500' as const, color: C.fg3, marginBottom: 6 },
  caption:      { fontSize: 12, color: C.fg3, lineHeight: 18 },
  empty:        { fontSize: 14, color: C.fg3, textAlign: 'center', lineHeight: 21 },
});
