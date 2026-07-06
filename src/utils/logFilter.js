function escapeRegexExceptWildcard(pattern) {
  return pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

function patternToRegex(pattern) {
  const escaped = escapeRegexExceptWildcard(pattern);
  const regexBody = escaped.split('*').join('.*');
  return new RegExp(regexBody, 'i');
}

function normalize(message) {
  return String(message || '').trim().replace(/\s+/g, ' ');
}

function matchesIgnorePattern(message, patterns) {
  const normalized = normalize(message);
  if (!normalized) return false;
  return patterns.some((pattern) => {
    const regex = pattern instanceof RegExp ? pattern : patternToRegex(pattern);
    return regex.test(normalized);
  });
}

function isIgnoredLog(log, patterns) {
  if (!log) return false;
  return matchesIgnorePattern(log.message, patterns);
}

module.exports = { isIgnoredLog, matchesIgnorePattern, patternToRegex };
