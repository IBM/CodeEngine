exports.escape = function escape(s) {
  return s.replace(/[\+\-\!\(\)\{\}\[\]\^\"\?\:\\\&\|\'\/\s\*\~]/g, prefixCharWithBackslashes);
};

function prefixCharWithBackslashes(char) {
  return '\\' + char;
}

exports.unescape = function unescape(s) {
  return s.replace(/\\([\+\-\!\(\)\{\}\[\]\^\"\?\:\\\&\|\'\/\s\*\~])/g, extractChar);
};

function extractChar(match, char) {
  return char;
}

exports.escapePhrase = function escapePhrase(s) {
  return s.replace(/"/g, prefixCharWithBackslashes);
};

exports.unescapePhrase = function unescapePhrase(s) {
  return s.replace(/\\(")/g, extractChar);
};
