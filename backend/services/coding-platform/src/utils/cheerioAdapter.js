let realCheerio = null;
try {
  realCheerio = require('cheerio');
} catch (e) {
  // Graceful fallback for serverless
}

const fallbackCheerio = {
  load: (html = '') => {
    return (selector) => {
      return {
        text: () => '',
        attr: () => '',
        find: () => ({ text: () => '', attr: () => '', each: () => {} }),
        each: () => {},
        first: () => ({ text: () => '', attr: () => '' }),
        length: 0,
      };
    };
  },
};

module.exports = realCheerio || fallbackCheerio;
