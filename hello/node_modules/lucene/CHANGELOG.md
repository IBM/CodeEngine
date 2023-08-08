# Changelog

## 2.1.1
 - Fix `toString` for parenthesized `NOT`.

## 2.1.0
 - Support regular expression terms.

## 2.0.4
 - Support `!` prefix.

## 2.0.3
 - Support leading whitespace in parenthesis.

## 2.0.2
 - Escape all whitespace characters in escaping / unescaping helpers.

## 2.0.1
 - `*` and `~` are not escaped/unescaped by the helpers introduced in release 2.0.0.

## 2.0.0
The AST previously tried (and failed very often) to store unescaped
terms within the AST. For a long time, this was buggy and actually resulted in an unclear role of the AST.
Especially undefined was whether or not the `term` field in an AST should contain escaped or unescaped
content.

With this `2.0.0` release, the meaning of the `term` field within the AST is changed. If you previously worked with
the AST directly and if you…

 1. relied on the `term` field containing unescaped input or
 2. set new values into the `term` field hoping that this this module would auto escape it,

then you will need to change your code!

When setting the `term` field, make sure that it is indeed valid, as it is copied verbatim to the output
when using `toString`. Should you be inserting user input, then you can use one of the new escaping helpers,
e.g. `lucene.term.escape('foo bar')`, to ensure that it is properly escaped.

When reading the `term` field, do accept that it can contain escape sequences. Unescape helpers exist which
should come in handy should you have to process these values, e.g. `lucene.term.unescape('foo\\ bar')`.

 - **Breaking**: Store escaped terms in AST.
 - Add helpers to escape (`lucene.term.escape('foo bar')`) and unescape (`lucene.term.unescape('foo\\ bar')`) terms.
 - Add helpers to escape (`lucene.phrase.escape('foo"bar')`) and unescape (`lucene.phrase.unescape('foo\\"bar')`) phrases.
 - Support empty quoted terms in `toString`.

## 1.3.0
 - Support whitespace between colon and term.
 - Include offset information.

## 1.2.0
 - Support mixed inclusive/exclusive range delimiters

## 1.1.3
 - Fix malformed `toString` output when using parenthesis.

## 1.1.2
 - Upgrade to pegjs 0.8
 - Support escaped characters in quoted strings.

## 1.1.1
 - Do not require ES2015 features.

## 1.1.0
 - Turn ASTs into queries via `lucene.toString(ast)`.
 - Retain information about quoted strings in the AST.
 - Retain original operators (`&&`, `||`) instead of translating it.

## 1.0.0
 - Initial release
