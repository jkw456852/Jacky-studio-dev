const normalizeEscapedNewlines = (value: string): string =>
  (value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n");

const LEGACY_MOJIBAKE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/闁圭瑳鍡╂斀濠㈡儼绮剧憴顩?閿涙瓥?/g, "执行失败："],
  [/閹笛嗩攽婢惰精瑙:锛歖?\s*/g, "执行失败："],
  [
    /濞达絿濮峰▓鎴炵▔閹惧磭娼ｉ悹浣瑰礃椤撴悂宕濋埡鍌氼杹闁挎稑鑻惔婊勬媴閻樺啿顥濋柛鎺斿濞撳爼宕ラ崼銉㈠亾閸屾粍鐣卞☉鎾存尭椤?/g,
    "",
  ],
  [
    /娴ｇ姷娈戞稉鎾崇潣鐠佹崘顓搁崝鈺傚閿涘苯搴滄担鐘冲閸掔増娓堕崥鍫モ偓鍌滄畱娑撴挸顔?/g,
    "",
  ],
];

export const normalizeLegacyAssistantMessageText = (value: string): string => {
  let normalized = normalizeEscapedNewlines(value || "");
  LEGACY_MOJIBAKE_REPLACEMENTS.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });
  return normalized;
};
