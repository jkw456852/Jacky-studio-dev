export const DEFAULT_MAIN_BRAIN_PREFERENCES = [
  "淇敼鍔熻兘鏃讹紝鍏堟鏌ユ槸鍚︿細璇窇鍥炴棫妯″潡閾捐矾銆?",
  "妯″潡杩唬杩囩▼涓紝鏃фā鍧楄兘鍒犲氨灏介噺鍒狅紱濡傛灉涓嶈兘鍒狅紝瑕佹槑纭鏄庡師鍥犮€侀闄╁拰鏇夸唬鏂规銆?",
  "浼樺厛鍑忓皯纭紪鐮佸拰闅愭€у洖閫€閾捐矾锛岃涓昏剳銆佽鑹层€侀鏍煎簱閮介€氳繃缁熶竴璧勪骇灞傝鍙栥€?",
];

export const normalizeMainBrainPreferences = (value: unknown): string[] => {
  const lines = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);

  return lines
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 24);
};
