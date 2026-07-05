function escapeRegexExceptWildcard(pattern) {
  return pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

function patternToRegex(pattern) {
  const escaped = escapeRegexExceptWildcard(pattern);
  const regexBody = escaped.split('*').join('.*');
  return new RegExp(`^${regexBody}$`, 'i');
}

function matchesIgnorePattern(message, patterns) {
  if (!message) return false;
  return patterns.some((pattern) => patternToRegex(pattern).test(message));
}

function isIgnoredLog(log, patterns) {
  if (!log) return false;
  return matchesIgnorePattern(log.message, patterns);
}

module.exports = { isIgnoredLog, matchesIgnorePattern, patternToRegex };
