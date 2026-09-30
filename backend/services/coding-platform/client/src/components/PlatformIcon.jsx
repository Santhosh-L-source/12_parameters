const PLATFORM_META = {
  LEETCODE:       { abbr: 'LC', label: 'LeetCode',       cls: 'leetcode' },
  CODEFORCES:     { abbr: 'CF', label: 'Codeforces',     cls: 'codeforces' },
  ATCODER:        { abbr: 'AC', label: 'AtCoder',        cls: 'atcoder' },
  CODECHEF:       { abbr: 'CC', label: 'CodeChef',       cls: 'codechef' },
  HACKERRANK:     { abbr: 'HR', label: 'HackerRank',     cls: 'hackerrank' },
  GEEKSFORGEEKS:  { abbr: 'GG', label: 'GeeksforGeeks',  cls: 'geeksforgeeks' },
  SKILLRACK:      { abbr: 'SR', label: 'SkillRack',      cls: 'skillrack' },
};

function getCustomMeta(platform, platformLabel) {
  const name = platformLabel || platform.replace('CUSTOM_', '').replace(/_/g, ' ');
  const abbr = name.substring(0, 2).toUpperCase();
  return { abbr, label: name, cls: 'custom-platform' };
}

export default function PlatformIcon({ platform, platformLabel }) {
  const meta = PLATFORM_META[platform] || getCustomMeta(platform, platformLabel);
  return (
    <span className="platform-pill">
      <span className={`platform-icon ${meta.cls}`}>{meta.abbr}</span>
      {meta.label}
    </span>
  );
}

export { PLATFORM_META };
