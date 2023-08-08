# urlp-js

[![Build Status](https://travis-ci.org/nowk/urlp-js.svg?branch=master)](https://travis-ci.org/nowk/urlp-js)
[![David DM](https://david-dm.org/nowk/urlp-js.png)](https://david-dm.org/nowk/urlp-js)

Simple url pattern matching


## Example

    let pattern = "/posts/:id";
    let path = "/posts/123"

    let m = match(pattern, path);
    if (m.match) {
      let post_id = m.params.id;

    }


## License

MIT
